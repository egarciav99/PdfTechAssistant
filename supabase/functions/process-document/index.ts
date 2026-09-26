/// <reference path="../types.d.ts" />
import pdf from 'npm:pdf-parse@1.1.1';
import { Buffer } from 'node:buffer';
import { authenticate, corsHeaders, json, serviceClient, toLang, UUID_RE, type Lang } from '../_shared/common.ts';
import { generateContent, generateEmbeddingsBatch } from '../_shared/gemini.ts';
import { buildSystemPrompt, NO_SUMMARY_HTML, summaryInstruction, type OrgProfile } from '../_shared/prompts.ts';
import { redactSensitiveData } from '../_shared/redaction.ts';

const generateSummary = async (text: string, org: OrgProfile, lang: Lang): Promise<string> => {
  const data = await generateContent(
    `${buildSystemPrompt(org, lang)}\n${summaryInstruction(lang)}`,
    [{ role: 'user', parts: [{ text: text.slice(0, 120000) }] }],
    undefined,
    'Summary request',
  );
  return data.candidates?.[0]?.content?.parts?.map((part: any) => part.text || '').join('').trim() || NO_SUMMARY_HTML[lang];
};

interface Chunk {
  content: string;
  sectionTitle: string;
  index: number;
}

const sectionPattern = /^\s*\d+(?:\.\d+)*\.?\s+.+$/;

const splitIntoChunks = (text: string, maxLength = 2500, overlap = 180): Chunk[] => {
  const normalized = text.replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  const paragraphs = normalized.split(/\n\s*\n/).map((item) => item.trim()).filter(Boolean);
  const chunks: Chunk[] = [];
  let current = '';
  let currentTitle = 'Introducción / General';
  let chunkTitle = currentTitle;

  const flush = () => {
    if (!current.trim()) return;
    chunks.push({ content: current.trim(), sectionTitle: chunkTitle, index: chunks.length + 1 });
    current = current.slice(Math.max(0, current.length - overlap));
    const boundary = current.indexOf(' ');
    if (boundary >= 0) current = current.slice(boundary + 1);
  };

  for (const paragraph of paragraphs) {
    const firstLine = paragraph.split('\n')[0].trim();
    if (sectionPattern.test(firstLine) && firstLine.length <= 180) {
      currentTitle = firstLine;
    }
    const sentences = paragraph.split(/(?<=[.!?])\s+/);
    for (const sentence of sentences) {
      if (current && current.length + sentence.length + 1 > maxLength) flush();
      if (!current) chunkTitle = currentTitle;
      current += `${current ? ' ' : ''}${sentence}`;
    }
  }
  flush();
  return chunks;
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return json(req, { error: 'Method not allowed' }, 405);

  const auth = await authenticate(req);
  if (!auth) return json(req, { error: 'Unauthorized' }, 401);
  const { user, userClient } = auth;

  let documentId = '';
  let lang: Lang = 'es';
  try {
    const body = await req.json();
    documentId = String(body.documentId || '');
    lang = toLang(body.lang);
  } catch {
    return json(req, { error: 'Invalid request' }, 400);
  }
  if (!UUID_RE.test(documentId)) return json(req, { error: 'Document not found' }, 404);

  const admin = serviceClient();
  try {
    // Con el cliente del usuario: RLS solo devuelve documentos de sus empresas.
    const { data: document } = await userClient.from('user_documents')
      .select('id, org_id, user_id, storage_path, status').eq('id', documentId).maybeSingle();
    if (!document) return json(req, { error: 'Document not found' }, 404);

    // Comprobación explícita de pertenencia a la empresa del documento.
    const { data: isMember } = await userClient.rpc('is_org_member', { p_org: document.org_id });
    if (!isMember) return json(req, { error: 'Document not found' }, 404);
    // Procesa (o reprocesa) quien lo subió o un admin de la empresa.
    const { data: isAdmin } = await userClient.rpc('is_org_admin', { p_org: document.org_id });
    if (document.user_id !== user.id && !isAdmin) return json(req, { error: 'Not allowed' }, 403);
    if (document.status === 'processing' || document.status === 'ready') {
      return json(req, { success: true, documentId, status: document.status });
    }

    const { data: org } = await admin.from('organizations')
      .select('specialty, assistant_instructions').eq('id', document.org_id).single();
    if (!org) return json(req, { error: 'Document not found' }, 404);

    // Evita dos procesamientos a la vez del mismo documento.
    const { data: claimed } = await admin.from('user_documents')
      .update({ status: 'processing', error_message: null })
      .eq('id', documentId).in('status', ['uploaded', 'error']).select('id');
    if (!claimed?.length) return json(req, { success: true, documentId, status: 'processing' });

    try {
      const { data: file, error: downloadError } = await admin.storage.from('documents').download(document.storage_path);
      if (downloadError || !file) throw downloadError || new Error('Could not download document');
      const buffer = await file.arrayBuffer();
      const parsed = await pdf(Buffer.from(buffer));
      // Se anonimizan los datos personales antes de indexar o enviar al modelo.
      const text = redactSensitiveData(parsed.text.trim());
      if (!text) throw new Error('No text extracted from PDF');

      const chunks = splitIntoChunks(text);
      if (!chunks.length) throw new Error('No usable text chunks generated');
      await admin.from('document_chunks').delete().eq('document_id', documentId);
      const embeddingInputs = chunks.map((chunk) => `[Sección: ${chunk.sectionTitle}] [Documento ${document.storage_path}] ${chunk.content}`);
      const vectors = await generateEmbeddingsBatch(embeddingInputs);
      const rows = chunks.map((chunk, index) => ({
        document_id: documentId,
        org_id: document.org_id,
        user_id: document.user_id,
        content: chunk.content,
        metadata: { Documento: document.storage_path, Titulo: chunk.sectionTitle, Pagina: 0, 'Paragraph Index': chunk.index },
        embedding: vectors[index],
      }));
      for (let start = 0; start < rows.length; start += 50) {
        const { error } = await admin.from('document_chunks').insert(rows.slice(start, start + 50));
        if (error) throw error;
      }

      const summary = await generateSummary(text, org, lang);
      const { error: summaryError } = await admin.from('summaries').upsert({
        document_id: documentId,
        org_id: document.org_id,
        user_id: document.user_id,
        content: summary,
        updated_at: new Date().toISOString(),
      });
      if (summaryError) throw summaryError;
      await admin.from('user_documents').update({ status: 'ready' }).eq('id', documentId);
      return json(req, { success: true, documentId, status: 'ready' });
    } catch (_error) {
      const referenceId = crypto.randomUUID();
      console.error(`[Process] document processing failed reference=${referenceId}`);
      const { error: cleanupError } = await admin.from('document_chunks').delete().eq('document_id', documentId);
      if (cleanupError) console.error('Failed to clean partial document chunks:', cleanupError);
      const safeMessage = `Document processing failed; reference=${referenceId}`;
      await admin.from('user_documents').update({ status: 'error', error_message: safeMessage }).eq('id', documentId);
      await admin.from('processing_errors').insert({ document_id: documentId, org_id: document.org_id, user_id: user.id, error: safeMessage });
      return json(req, { error: safeMessage }, 500);
    }
  } catch (_error) {
    const referenceId = crypto.randomUUID();
    console.error(`[Process] request failed reference=${referenceId}`);
    return json(req, { error: `Internal server error; reference=${referenceId}` }, 500);
  }
});
