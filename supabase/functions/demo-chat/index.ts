/// <reference path="../types.d.ts" />
// Demo pública sin login (/demo): responde preguntas sobre el documento de ejemplo.
// Solo lee documentos de empresas con is_demo = true (match_demo_chunks) y limita las
// preguntas por visitante y por día. De la IP solo se guarda un hash con sal.
import { json, corsHeaders, serviceClient, toLang, type Lang } from '../_shared/common.ts';
import { buildSystemPrompt } from '../_shared/prompts.ts';
import { answerFromDocument, type ChunkMatch } from '../_shared/rag.ts';

const PER_VISITOR = Number(Deno.env.get('DEMO_DAILY_LIMIT') || 5);
const GLOBAL = Number(Deno.env.get('DEMO_GLOBAL_DAILY_LIMIT') || 300);
const MAX_QUERY = 500;

/** Hash de la IP del visitante (nunca se guarda la IP). */
async function visitorKey(req: Request): Promise<string> {
  const ip = (req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
  const salt = Deno.env.get('DEMO_SALT') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${ip}`));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Documento de la demo: el último documento listo de una empresa demo. */
async function demoDocument(admin: any) {
  const { data: orgs } = await admin.from('organizations').select('id, name, specialty, assistant_instructions').eq('is_demo', true);
  if (!orgs?.length) return null;
  const { data: doc } = await admin.from('user_documents')
    .select('id, org_id, original_name')
    .in('org_id', orgs.map((o: { id: string }) => o.id))
    .eq('status', 'ready')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!doc) return null;
  const org = orgs.find((o: { id: string }) => o.id === doc.org_id);
  const { data: summary } = await admin.from('summaries').select('content').eq('document_id', doc.id).maybeSingle();
  return { id: doc.id as string, name: doc.original_name as string, org, summary: (summary?.content as string) || '' };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return json(req, { error: 'Method not allowed' }, 405);

  let action = '';
  let query = '';
  let lang: Lang = 'es';
  try {
    const body = await req.json();
    action = body.action === 'ask' ? 'ask' : 'info';
    query = typeof body.query === 'string' ? body.query.trim() : '';
    lang = toLang(body.lang);
  } catch {
    return json(req, { error: 'Invalid request' }, 400);
  }

  try {
    const admin = serviceClient();
    const doc = await demoDocument(admin);
    if (!doc) return json(req, { available: false });
    const visitor = await visitorKey(req);

    if (action === 'info') {
      const { data: left } = await admin.rpc('demo_questions_left', { p_visitor: visitor, p_limit: PER_VISITOR });
      return json(req, { available: true, document: { name: doc.name, summary: doc.summary }, questionsLeft: left ?? PER_VISITOR, limit: PER_VISITOR });
    }

    if (!query) return json(req, { error: 'query is required' }, 400);
    if (query.length > MAX_QUERY) return json(req, { error: 'query too long', code: 'too_long' }, 400);

    const { data: left, error: quotaError } = await admin.rpc('consume_demo_question', { p_visitor: visitor, p_limit: PER_VISITOR, p_global_limit: GLOBAL });
    if (quotaError) throw quotaError;
    if (left === -1) return json(req, { error: 'Daily demo limit reached', code: 'limit' }, 429);
    if (left === -2) return json(req, { error: 'Demo busy today', code: 'busy' }, 429);

    const html = await answerFromDocument({
      systemPrompt: buildSystemPrompt(doc.org, lang),
      history: [],
      documentId: doc.id,
      query,
      lang,
      search: async (embedding, limit) => {
        const { data: matches, error: matchError } = await admin.rpc('match_demo_chunks', { query_embedding: embedding, requested_document_id: doc.id, match_threshold: 0.45, match_count: limit });
        if (matchError) throw matchError;
        return (matches || []) as ChunkMatch[];
      },
    });
    return json(req, { output: html, questionsLeft: left });
  } catch (_error) {
    const referenceId = crypto.randomUUID();
    console.error(`[Demo] request failed reference=${referenceId}`);
    return json(req, { error: `Demo request failed; reference=${referenceId}` }, 500);
  }
});
