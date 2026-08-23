/// <reference path="../types.d.ts" />
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { CHAT_SYSTEM_PROMPT, NO_RESULTS_HTML } from '../_shared/prompts.ts';
import { retryTransient } from '../_shared/retry.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const geminiKey = Deno.env.get('GEMINI_API_KEY')!;
const embeddingModel = 'gemini-embedding-001';
const chatModel = 'gemini-3.6-flash';
const DOCUMENT_NOT_READY_HTML = '<div style="padding:15px;background:#fff7ed;color:#9a3412;border:1px solid #fdba74;border-radius:8px;font-family:Arial,sans-serif"><strong>Documento no disponible</strong><br>El documento todavía se está procesando o terminó con error. Espera a que finalice el procesamiento y vuelve a intentarlo.</div>';

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

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

const embedding = async (text: string): Promise<number[]> => {
  const data = await requestGemini(
    `https://generativelanguage.googleapis.com/v1beta/models/${embeddingModel}:embedContent?key=${geminiKey}`,
    { content: { parts: [{ text }] }, outputDimensionality: 768 },
    'Embedding request',
  );
  return data.embedding.values;
};

const generate = async (contents: unknown[], tools?: unknown[]) => {
  return requestGemini(
    `https://generativelanguage.googleapis.com/v1beta/models/${chatModel}:generateContent?key=${geminiKey}`,
    { systemInstruction: { parts: [{ text: CHAT_SYSTEM_PROMPT }] }, contents, tools },
    'Chat generation request',
  );
};

const tool = {
  functionDeclarations: [{
    name: 'search_document_chunks',
    description: 'Busca evidencia únicamente dentro del documento activo.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: { type: 'STRING', description: 'Consulta específica o amplia para recuperar evidencia.' },
        documentId: { type: 'STRING', description: 'UUID exacto del documento activo.' },
        limit: { type: 'INTEGER', description: 'Cantidad de fragmentos, entre 1 y 8.' },
      },
      required: ['query', 'documentId'],
    },
  }],
};

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) return json({ error: 'Unauthorized' }, 401);
    const client = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: { user }, error: userError } = await client.auth.getUser(token);
    if (userError || !user) return json({ error: 'Unauthorized' }, 401);

    const { query, sessionId, documentId } = await request.json();
    if (!query || !sessionId || !documentId) return json({ error: 'query, sessionId and documentId are required' }, 400);

    const { data: document, error: documentError } = await client.from('user_documents').select('id, status, error_message').eq('id', documentId).eq('user_id', user.id).single();
    if (documentError || !document) return json({ error: 'Document not found' }, 404);
    if (document.status !== 'ready') return json({ output: DOCUMENT_NOT_READY_HTML, sessionId, status: document.status, error: document.error_message });
    const { data: session, error: sessionError } = await client.from('chat_sessions').upsert({ id: sessionId, user_id: user.id, document_id: documentId }, { onConflict: 'id' }).select().single();
    if (sessionError || !session) return json({ error: 'Invalid chat session' }, 400);

    const { data: history } = await client.from('chat_messages').select('role, content').eq('session_id', sessionId).order('created_at', { ascending: false }).limit(10);
    const contents: any[] = (history || []).reverse().map((message: { role: string; content: string }) => ({ role: message.role === 'assistant' ? 'model' : 'user', parts: [{ text: message.content }] }));
    contents.push({ role: 'user', parts: [{ text: `Documento activo: ${documentId}\nConsulta: ${query}\nDebes usar la herramienta antes de responder.` }] });

    let result = await generate(contents, [tool]);
    let foundResultsInRequest = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      const parts = result.candidates?.[0]?.content?.parts || [];
      const calls = parts.filter((part: any) => part.functionCall);
      if (!calls.length) break;
      const functionParts = [];
      let foundResultsInTurn = false;
      for (const part of calls) {
        const args = part.functionCall.args || {};
        const searchText = typeof args.query === 'string' && args.query.trim() ? args.query : query;
        const vector = await embedding(searchText);
        const limit = Math.min(Math.max(Number(args.limit) || 4, 1), 8);
        const { data: matches, error: matchError } = await client.rpc('match_document_chunks', { query_embedding: vector, requested_document_id: documentId, match_threshold: 0.45, match_count: limit });
        if (matchError) throw matchError;
        if (matches?.length) {
          foundResultsInTurn = true;
          foundResultsInRequest = true;
        }
        functionParts.push({ functionResponse: { name: 'search_document_chunks', response: { documentId, results: matches } } });
      }
      contents.push({ role: 'model', parts });
      contents.push({ role: 'user', parts: functionParts });
      result = await generate(contents, [tool]);

      if (!foundResultsInTurn && !foundResultsInRequest) {
        return json({ output: NO_RESULTS_HTML, sessionId });
      }
    }

    const output = result.candidates?.[0]?.content?.parts?.map((part: any) => part.text || '').join('').trim() || NO_RESULTS_HTML;
    const html = output.startsWith('<div') ? output : NO_RESULTS_HTML;
    await client.from('chat_messages').insert([
      { session_id: sessionId, user_id: user.id, role: 'user', content: query },
      { session_id: sessionId, user_id: user.id, role: 'assistant', content: html },
    ]);
    return json({ output: html, sessionId });
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : 'Internal server error' }, 500);
  }
});
