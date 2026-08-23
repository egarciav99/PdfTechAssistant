import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import pdf from 'npm:pdf-parse@1.1.1';
import { Buffer } from 'node:buffer';
import { CHAT_SYSTEM_PROMPT } from '../_shared/prompts.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const geminiKey = Deno.env.get('GEMINI_API_KEY')!;
const admin = createClient(supabaseUrl, serviceKey);
const embeddingModel = 'gemini-embedding-001';
const chatModel = 'gemini-2.0-flash';

const generateEmbedding = async (text: string): Promise<number[]> => {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${embeddingModel}:embedContent?key=${geminiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: { parts: [{ text }] }, outputDimensionality: 768 }),
  });
  if (!response.ok) throw new Error(`Embedding request failed: ${await response.text()}`);
  return (await response.json()).embedding.values;
};

const generateSummary = async (text: string): Promise<string> => {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${chatModel}:generateContent?key=${geminiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: `${CHAT_SYSTEM_PROMPT}\nGenera un resumen técnico HTML inline del documento completo.` }] },
      contents: [{ role: 'user', parts: [{ text: text.slice(0, 120000) }] }],
    }),
  });
  if (!response.ok) throw new Error(`Summary request failed: ${await response.text()}`);
  return (await response.json()).candidates?.[0]?.content?.parts?.map((part: any) => part.text || '').join('').trim() || '<div>No se pudo generar el resumen.</div>';
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
      const text = parsed.text.replace(/\s+/g, ' ').trim();
      if (!text) throw new Error('No text extracted from PDF');

      const chunks = text.match(/.{1,2500}(?:\s|$)/g) || [text];
      await admin.from('document_chunks').delete().eq('document_id', documentId);
      for (let index = 0; index < chunks.length; index++) {
        const content = chunks[index].trim();
        if (!content) continue;
        const vector = await generateEmbedding(`[Documento ${document.storage_path}] ${content}`);
        const { error } = await admin.from('document_chunks').insert({ document_id: documentId, user_id: user.id, content, metadata: { Documento: document.storage_path, Titulo: `Fragmento ${index + 1}`, Pagina: 0, 'Paragraph Index': index + 1 }, embedding: vector });
        if (error) throw error;
      }

      const summary = await generateSummary(text);
      const { error: summaryError } = await admin.from('summaries').upsert({ document_id: documentId, user_id: user.id, content: summary, updated_at: new Date().toISOString() });
      if (summaryError) throw summaryError;
      await admin.from('user_documents').update({ status: 'ready' }).eq('id', documentId);
      return json({ success: true, documentId });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await admin.from('user_documents').update({ status: 'error', error_message: message }).eq('id', documentId);
      await admin.from('processing_errors').insert({ document_id: documentId, user_id: user.id, error: message });
      return json({ error: message }, 500);
    }
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Internal server error' }, 500);
  }
});
