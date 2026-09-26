/// <reference path="../types.d.ts" />
import { authenticate, corsHeaders, json, toLang, UUID_RE, type Lang } from '../_shared/common.ts';
import { generateContent, generateEmbedding } from '../_shared/gemini.ts';
import { buildSystemPrompt, DOCUMENT_NOT_READY_HTML, NO_RESULTS_HTML } from '../_shared/prompts.ts';

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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return json(req, { error: 'Method not allowed' }, 405);

  try {
    const auth = await authenticate(req);
    if (!auth) return json(req, { error: 'Unauthorized' }, 401);
    const { user, userClient: client } = auth;

    let query = '';
    let sessionId = '';
    let documentId = '';
    let lang: Lang = 'es';
    try {
      const body = await req.json();
      query = typeof body.query === 'string' ? body.query.trim().slice(0, 4000) : '';
      sessionId = typeof body.sessionId === 'string' ? body.sessionId.slice(0, 200) : '';
      documentId = typeof body.documentId === 'string' ? body.documentId : '';
      lang = toLang(body.lang);
    } catch {
      return json(req, { error: 'Invalid request' }, 400);
    }
    if (!query || !sessionId || !documentId) return json(req, { error: 'query, sessionId and documentId are required' }, 400);
    if (!UUID_RE.test(documentId)) return json(req, { error: 'Document not found' }, 404);

    // RLS: solo devuelve el documento si es de una empresa del usuario.
    const { data: document } = await client.from('user_documents')
      .select('id, org_id, status, error_message').eq('id', documentId).maybeSingle();
    if (!document) return json(req, { error: 'Document not found' }, 404);
    const { data: isMember } = await client.rpc('is_org_member', { p_org: document.org_id });
    if (!isMember) return json(req, { error: 'Document not found' }, 404);
    if (document.status !== 'ready') {
      return json(req, { output: DOCUMENT_NOT_READY_HTML[lang], sessionId, status: document.status, error: document.error_message });
    }

    const { data: org } = await client.from('organizations')
      .select('specialty, assistant_instructions').eq('id', document.org_id).single();
    if (!org) return json(req, { error: 'Document not found' }, 404);
    const systemPrompt = buildSystemPrompt(org, lang);

    // La sesión es privada del usuario (RLS) y queda ligada a la empresa del documento.
    const { data: existing } = await client.from('chat_sessions').select('id, document_id').eq('id', sessionId).maybeSingle();
    if (existing && existing.document_id !== documentId) return json(req, { error: 'Invalid chat session' }, 400);
    if (!existing) {
      const { error: sessionError } = await client.from('chat_sessions')
        .insert({ id: sessionId, user_id: user.id, document_id: documentId, org_id: document.org_id });
      if (sessionError) return json(req, { error: 'Invalid chat session' }, 400);
    }

    const { data: history } = await client.from('chat_messages').select('role, content').eq('session_id', sessionId).order('created_at', { ascending: false }).limit(10);
    const contents: any[] = (history || []).reverse().map((message: { role: string; content: string }) => ({ role: message.role === 'assistant' ? 'model' : 'user', parts: [{ text: message.content }] }));
    contents.push({ role: 'user', parts: [{ text: `Documento activo: ${documentId}\nConsulta: ${query}\nDebes usar la herramienta antes de responder.` }] });

    let result = await generateContent(systemPrompt, contents, [tool]);
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
        const vector = await generateEmbedding(searchText);
        const limit = Math.min(Math.max(Number(args.limit) || 4, 1), 8);
        // Siempre el documento activo: se ignora el documentId que proponga el modelo.
        const { data: matches, error: matchError } = await client.rpc('match_document_chunks', { query_embedding: vector, requested_document_id: documentId, match_threshold: 0.45, match_count: limit });
        if (matchError) throw matchError;
        if (matches?.length) {
          foundResultsInTurn = true;
          foundResultsInRequest = true;
        }
        const dataResults = (matches || []).map((match: { content: string; metadata: unknown; similarity: number }) => ({
          ...match,
          content: `<<<BEGIN RETRIEVED DATA>>>\n${match.content}\n<<<END RETRIEVED DATA>>>`,
        }));
        functionParts.push({ functionResponse: { name: 'search_document_chunks', response: { documentId, results: dataResults } } });
      }
      contents.push({ role: 'model', parts });
      contents.push({ role: 'user', parts: functionParts });
      result = await generateContent(systemPrompt, contents, [tool]);

      if (!foundResultsInTurn && !foundResultsInRequest) {
        return json(req, { output: NO_RESULTS_HTML[lang], sessionId });
      }
    }

    const output = result.candidates?.[0]?.content?.parts?.map((part: any) => part.text || '').join('').trim() || NO_RESULTS_HTML[lang];
    const html = output.startsWith('<div') ? output : NO_RESULTS_HTML[lang];
    await client.from('chat_messages').insert([
      { session_id: sessionId, user_id: user.id, role: 'user', content: query },
      { session_id: sessionId, user_id: user.id, role: 'assistant', content: html },
    ]);
    return json(req, { output: html, sessionId });
  } catch (_error) {
    const referenceId = crypto.randomUUID();
    console.error(`[Chat] request failed reference=${referenceId}`);
    return json(req, { error: `Chat request failed; reference=${referenceId}` }, 500);
  }
});
