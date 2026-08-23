/// <reference path="../types.d.ts" />
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import pdf from 'npm:pdf-parse@1.1.1';
import { Buffer } from 'node:buffer';
import { CHAT_SYSTEM_PROMPT } from '../_shared/prompts.ts';
import { mapWithConcurrency, retryTransient } from '../_shared/retry.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const geminiKey = Deno.env.get('GEMINI_API_KEY')!;
const admin = createClient(supabaseUrl, serviceKey);
const embeddingModel = 'gemini-embedding-001';
const chatModel = 'gemini-3.6-flash';

class GeminiHttpError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const requestGemini = async (url: string, body: unknown, label: string): Promise<any> =>
  retryTransient(async () => {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new GeminiHttpError(`${label}: ${await response.text()}`, response.status);
    return response.json();
  }, label);

const generateEmbedding = async (text: string): Promise<number[]> => {
  const data = await requestGemini(
    `https://generativelanguage.googleapis.com/v1beta/models/${embeddingModel}:embedContent?key=${geminiKey}`,
    { content: { parts: [{ text }] }, outputDimensionality: 768 },
    'Embedding request',
  );
  return data.embedding.values;
};

const generateEmbeddingsBatch = async (texts: string[]): Promise<number[][]> => {
  try {
    const data = await requestGemini(
      `https://generativelanguage.googleapis.com/v1beta/models/${embeddingModel}:batchEmbedContents?key=${geminiKey}`,
      { requests: texts.map((text) => ({
        model: `models/${embeddingModel}`,
        content: { parts: [{ text }] },
        outputDimensionality: 768,
      })) },
      'Batch embedding request',
    );
    return data.embeddings.map((item: { values: number[] }) => item.values);
  } catch (error) {
    console.warn('Batch embeddings unavailable; using limited parallel fallback', error);
    return mapWithConcurrency(texts, 5, generateEmbedding);
  }
};

const generateSummary = async (text: string): Promise<string> => {
  const data = await requestGemini(
    `https://generativelanguage.googleapis.com/v1beta/models/${chatModel}:generateContent?key=${geminiKey}`,
    {
      systemInstruction: { parts: [{ text: `${CHAT_SYSTEM_PROMPT}\nGenera un resumen técnico HTML inline del documento completo.` }] },
      contents: [{ role: 'user', parts: [{ text: text.slice(0, 120000) }] }],
    },
    'Summary request',
  );
  return data.candidates?.[0]?.content?.parts?.map((part: any) => part.text || '').join('').trim() || '<div>No se pudo generar el resumen.</div>';
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

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return json({ error: 'Unauthorized' }, 401);
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: { user } } = await userClient.auth.getUser(token);
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const { documentId } = await request.json();
    const { data: document, error: documentError } = await admin.from('user_documents').select('id, user_id, storage_path').eq('id', documentId).eq('user_id', user.id).single();
    if (documentError || !document) return json({ error: 'Document not found' }, 404);

    await admin.from('user_documents').update({ status: 'processing', error_message: null }).eq('id', documentId);
    try {
      const { data: file, error: downloadError } = await admin.storage.from('documents').download(document.storage_path);
      if (downloadError || !file) throw downloadError || new Error('Could not download document');
      const buffer = await file.arrayBuffer();
      const parsed = await pdf(Buffer.from(buffer));
      const text = parsed.text.trim();
      if (!text) throw new Error('No text extracted from PDF');

      const chunks = splitIntoChunks(text);
      if (!chunks.length) throw new Error('No usable text chunks generated');
      await admin.from('document_chunks').delete().eq('document_id', documentId);
      const embeddingInputs = chunks.map((chunk) => `[Sección: ${chunk.sectionTitle}] [Documento ${document.storage_path}] ${chunk.content}`);
      const vectors = await generateEmbeddingsBatch(embeddingInputs);
      for (let index = 0; index < chunks.length; index++) {
        const chunk = chunks[index];
        const { error } = await admin.from('document_chunks').insert({ document_id: documentId, user_id: user.id, content: chunk.content, metadata: { Documento: document.storage_path, Titulo: chunk.sectionTitle, Pagina: 0, 'Paragraph Index': chunk.index }, embedding: vectors[index] });
        if (error) throw error;
      }

      const summary = await generateSummary(text);
      const { error: summaryError } = await admin.from('summaries').upsert({ document_id: documentId, user_id: user.id, content: summary, updated_at: new Date().toISOString() });
      if (summaryError) throw summaryError;
      await admin.from('user_documents').update({ status: 'ready' }).eq('id', documentId);
      return json({ success: true, documentId });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const { error: cleanupError } = await admin.from('document_chunks').delete().eq('document_id', documentId);
      if (cleanupError) console.error('Failed to clean partial document chunks:', cleanupError);
      await admin.from('user_documents').update({ status: 'error', error_message: message }).eq('id', documentId);
      await admin.from('processing_errors').insert({ document_id: documentId, user_id: user.id, error: message });
      return json({ error: message }, 500);
    }
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Internal server error' }, 500);
  }
});
