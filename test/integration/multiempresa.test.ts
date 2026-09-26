/**
 * Pruebas de aislamiento entre empresas (RLS + Storage) y de las Edge Functions
 * contra el Supabase local. Requisitos (ver docs/ENTREGA.md → Pruebas):
 *   npx supabase start
 *   node test/e2e/gemini-mock.mjs
 *   npx supabase functions serve --env-file test/e2e/functions.env
 */
import { beforeAll, describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  anonClient, callFunction, ensureUser, GEMINI_MOCK_URL, serviceClient, signIn, uniq, uploadDocument,
} from './helpers';

const run = uniq();
const email = (who: string) => `${who}-${run}@example.test`;

let superadmin: SupabaseClient;
let adminA: SupabaseClient;
let userA: SupabaseClient;
let adminB: SupabaseClient;
let userB: SupabaseClient;
let orgA: string;
let orgB: string;
let ids: Record<string, string> = {};
let docA: { id: string; storage_path: string };

async function createOrg(slug: string, adminEmail: string, specialty = 'electrical'): Promise<string> {
  const res = await callFunction(superadmin, 'manage-members', {
    action: 'create_org', name: `Empresa ${slug}`, slug, admin_email: adminEmail, specialty,
  });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return res.body.org.id;
}

beforeAll(async () => {
  const service = serviceClient();
  ids.super = await ensureUser(email('super'));
  await service.from('platform_admins').upsert({ user_id: ids.super });
  superadmin = await signIn(email('super'));

  orgA = await createOrg(`a-${run}`, email('admin-a'));
  orgB = await createOrg(`b-${run}`, email('admin-b'), 'civil');

  // create_org invita al admin (sin contraseña): se le pone una para poder entrar.
  ids.adminA = await ensureUser(email('admin-a'));
  ids.adminB = await ensureUser(email('admin-b'));
  adminA = await signIn(email('admin-a'));
  adminB = await signIn(email('admin-b'));

  for (const [client, org, who] of [[adminA, orgA, 'user-a'], [adminB, orgB, 'user-b']] as const) {
    const res = await callFunction(client, 'manage-members', { action: 'invite', org_id: org, email: email(who), role: 'user' });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
  }
  ids.userA = await ensureUser(email('user-a'));
  ids.userB = await ensureUser(email('user-b'));
  userA = await signIn(email('user-a'));
  userB = await signIn(email('user-b'));

  await fetch(`${GEMINI_MOCK_URL}/__requests`, { method: 'DELETE' });
  docA = await uploadDocument(adminA, orgA);
  const processed = await callFunction(adminA, 'process-document', { documentId: docA.id, lang: 'es' });
  expect(processed.status, JSON.stringify(processed.body)).toBe(200);
}, 120_000);

describe('registro', () => {
  it('el registro libre está desactivado', async () => {
    const { error } = await anonClient().auth.signUp({ email: email('intruso'), password: 'Prueba-1234!' });
    expect(error).not.toBeNull();
  });
});

describe('aislamiento entre empresas', () => {
  it('un usuario de B no ve nada de A en las tablas', async () => {
    for (const table of ['user_documents', 'document_chunks', 'summaries', 'chat_sessions', 'processing_errors']) {
      const { data, error } = await userB.from(table).select('*').eq('org_id', orgA);
      expect(error, table).toBeNull();
      expect(data, table).toEqual([]);
    }
    const messages = await userB.from('chat_messages').select('*').neq('user_id', ids.userB);
    expect(messages.data).toEqual([]);
    const docs = await userB.from('user_documents').select('id').eq('id', docA.id);
    expect(docs.data).toEqual([]);
    const orgs = await userB.from('organizations').select('id');
    expect(orgs.data?.map((o) => o.id)).toEqual([orgB]);
    const mems = await userB.from('memberships').select('org_id');
    expect(mems.data?.every((m) => m.org_id === orgB)).toBe(true);
  });

  it('un admin de B tampoco ve A (ni sus miembros)', async () => {
    expect((await adminB.from('user_documents').select('id').eq('org_id', orgA)).data).toEqual([]);
    expect((await adminB.from('summaries').select('document_id').eq('org_id', orgA)).data).toEqual([]);
    const members = await adminB.rpc('org_members', { p_org: orgA });
    expect(members.error).not.toBeNull();
  });

  it('la búsqueda semántica no devuelve fragmentos de otra empresa', async () => {
    const vector = Array.from({ length: 768 }, () => 1 / Math.sqrt(768));
    const other = await userB.rpc('match_document_chunks', { query_embedding: vector, requested_document_id: docA.id, match_threshold: 0, match_count: 8 });
    expect(other.data).toEqual([]);
    const own = await userA.rpc('match_document_chunks', { query_embedding: vector, requested_document_id: docA.id, match_threshold: 0, match_count: 8 });
    expect(own.data?.length).toBeGreaterThan(0);
  });

  it('Storage: B no descarga, lista ni sube en la carpeta de A', async () => {
    const download = await userB.storage.from('documents').download(docA.storage_path);
    expect(download.data).toBeNull();
    const list = await userB.storage.from('documents').list(`${orgA}/${ids.adminA}`);
    expect(list.data ?? []).toEqual([]);
    const upload = await userB.storage.from('documents').upload(`${orgA}/${ids.userB}/intruso.pdf`, new Blob(['%PDF-1.4'], { type: 'application/pdf' }));
    expect(upload.error).not.toBeNull();
    const own = await userA.storage.from('documents').download(docA.storage_path);
    expect(own.error).toBeNull();
  });

  it('B no puede crear documentos en A ni apuntar a archivos de A', async () => {
    const intoA = await userB.from('user_documents').insert({ org_id: orgA, user_id: ids.userB, original_name: 'x.pdf', storage_path: `${orgA}/${ids.userB}/x.pdf` });
    expect(intoA.error).not.toBeNull();
    const pointing = await userB.from('user_documents').insert({ org_id: orgB, user_id: ids.userB, original_name: 'x.pdf', storage_path: docA.storage_path });
    expect(pointing.error).not.toBeNull();
    const asOther = await userB.from('user_documents').insert({ org_id: orgB, user_id: ids.adminB, original_name: 'x.pdf', storage_path: `${orgB}/${ids.adminB}/x.pdf` });
    expect(asOther.error).not.toBeNull();
  });

  it('las Edge Functions rechazan documentos de otra empresa', async () => {
    const processed = await callFunction(userB, 'process-document', { documentId: docA.id });
    expect(processed.status).toBe(404);
    const chat = await callFunction(userB, 'chat-with-document', { query: '¿Calibre?', sessionId: `s-${uniq()}`, documentId: docA.id });
    expect(chat.status).toBe(404);
    const anon = await callFunction(anonClient(), 'chat-with-document', { query: 'x', sessionId: 'x', documentId: docA.id });
    expect(anon.status).toBe(401);
  });
});

describe('documentos dentro de la empresa', () => {
  it('el usuario ve los documentos, el resumen y puede preguntar', async () => {
    const docs = await userA.from('user_documents').select('id, status').eq('org_id', orgA);
    expect(docs.data).toEqual([{ id: docA.id, status: 'ready' }]);
    const summary = await userA.from('summaries').select('content').eq('document_id', docA.id).single();
    expect(summary.data?.content).toContain('Resumen técnico');
    const chat = await callFunction(userA, 'chat-with-document', { query: '¿Qué calibre tiene el alimentador?', sessionId: `s-${uniq()}`, documentId: docA.id, lang: 'es' });
    expect(chat.status).toBe(200);
    expect(chat.body.output).toContain('Según el documento');
    expect(chat.body.output).toContain('4/0 AWG');
  });

  it('responde en inglés cuando la interfaz está en inglés', async () => {
    const chat = await callFunction(userA, 'chat-with-document', { query: 'Which gauge?', sessionId: `s-${uniq()}`, documentId: docA.id, lang: 'en' });
    expect(chat.body.output).toContain('According to the document');
  });

  it('usa el prompt de la especialidad de la empresa', async () => {
    const res = await fetch(`${GEMINI_MOCK_URL}/__requests`);
    const bodies = JSON.stringify(await res.json());
    expect(bodies).toContain('Ingeniero Eléctrico Senior');
  });

  it('anonimiza los datos personales antes de enviarlos al modelo o indexarlos', async () => {
    const res = await fetch(`${GEMINI_MOCK_URL}/__requests`);
    const bodies = JSON.stringify(await res.json());
    expect(bodies).not.toContain('residente@ejemplo.com');
    expect(bodies).toContain('[EMAIL_REDACTADO]');
    const chunks = await userA.from('document_chunks').select('content').eq('document_id', docA.id);
    expect(JSON.stringify(chunks.data)).not.toContain('residente@ejemplo.com');
  });

  it('los usuarios suben documentos, pero solo borran los suyos; el admin borra cualquiera', async () => {
    const own = await uploadDocument(userA, orgA, 'propio.pdf');
    const byUser = await userA.from('user_documents').delete().eq('id', docA.id).select('id');
    expect(byUser.data).toEqual([]);
    const ownDelete = await userA.from('user_documents').delete().eq('id', own.id).select('id');
    expect(ownDelete.data).toEqual([{ id: own.id }]);

    const another = await uploadDocument(userA, orgA, 'otro.pdf');
    const byAdmin = await adminA.from('user_documents').delete().eq('id', another.id).select('id');
    expect(byAdmin.data).toEqual([{ id: another.id }]);
    const file = await adminA.storage.from('documents').remove([another.storage_path]);
    expect(file.data?.length).toBe(1);
  });

  it('un usuario no puede reprocesar ni cambiar el estado de un documento ajeno', async () => {
    const processed = await callFunction(userA, 'process-document', { documentId: docA.id });
    expect([200, 403]).toContain(processed.status);
    const update = await userA.from('user_documents').update({ status: 'error' }).eq('id', docA.id).select('id');
    expect(update.data ?? []).toEqual([]);
  });
});

describe('conversaciones privadas', () => {
  it('cada persona ve solo sus conversaciones (ni el admin ni el superadmin ven las demás)', async () => {
    const sessionId = `privada-${uniq()}`;
    const chat = await callFunction(userA, 'chat-with-document', { query: 'Tablero principal', sessionId, documentId: docA.id });
    expect(chat.status).toBe(200);
    expect((await userA.from('chat_messages').select('id').eq('session_id', sessionId)).data?.length).toBe(2);
    expect((await adminA.from('chat_messages').select('id').eq('session_id', sessionId)).data).toEqual([]);
    expect((await superadmin.from('chat_messages').select('id').eq('session_id', sessionId)).data).toEqual([]);
    expect((await adminA.from('chat_sessions').select('id').eq('id', sessionId)).data).toEqual([]);
  });

  it('no se puede escribir en la sesión de otra persona', async () => {
    const sessionId = `ajena-${uniq()}`;
    await callFunction(userA, 'chat-with-document', { query: 'Tablero', sessionId, documentId: docA.id });
    const hijack = await callFunction(adminA, 'chat-with-document', { query: 'Tablero', sessionId, documentId: docA.id });
    expect(hijack.status).toBe(400);
  });
});

describe('empresa y miembros', () => {
  it('el usuario no edita la empresa; el admin sí (pero no el identificador)', async () => {
    const byUser = await userA.from('organizations').update({ name: 'Hackeada' }).eq('id', orgA).select('id');
    expect(byUser.data ?? []).toEqual([]);
    const byAdmin = await adminA.from('organizations')
      .update({ name: 'Empresa A editada', specialty: 'civil', assistant_instructions: 'Usa unidades del SI.' })
      .eq('id', orgA).select('name, specialty');
    expect(byAdmin.data).toEqual([{ name: 'Empresa A editada', specialty: 'civil' }]);
    const slug = await adminA.from('organizations').update({ slug: `otro-${run}` }).eq('id', orgA);
    expect(slug.error).not.toBeNull();
    const bad = await adminA.from('organizations').update({ specialty: 'inventada' }).eq('id', orgA);
    expect(bad.error).not.toBeNull();
    await adminA.from('organizations').update({ specialty: 'electrical' }).eq('id', orgA);
  });

  it('manage-members respeta los roles', async () => {
    expect((await callFunction(userA, 'manage-members', { action: 'invite', org_id: orgA, email: email('x'), role: 'user' })).status).toBe(403);
    expect((await callFunction(adminA, 'manage-members', { action: 'invite', org_id: orgB, email: email('x'), role: 'user' })).status).toBe(403);
    expect((await callFunction(adminA, 'manage-members', { action: 'create_org', name: 'X', slug: `x-${run}`, admin_email: email('x') })).status).toBe(403);
    const last = await callFunction(adminA, 'manage-members', { action: 'set_role', org_id: orgA, user_id: ids.adminA, role: 'user' });
    expect(last.status).toBe(409);
    expect(last.body.code).toBe('last_admin');
    const dup = await callFunction(superadmin, 'manage-members', { action: 'create_org', name: 'Dup', slug: `a-${run}`, admin_email: email('x') });
    expect(dup.body.code).toBe('slug_taken');
  });

  it('solo el admin lista los miembros', async () => {
    expect((await userA.rpc('org_members', { p_org: orgA })).error).not.toBeNull();
    const list = await adminA.rpc('org_members', { p_org: orgA });
    expect(list.data?.map((m: { email: string }) => m.email).sort()).toEqual([email('admin-a'), email('user-a')].sort());
  });

  it('el superadmin entra en cualquier empresa', async () => {
    const orgs = await superadmin.from('organizations').select('id');
    expect(orgs.data?.map((o) => o.id)).toEqual(expect.arrayContaining([orgA, orgB]));
    expect((await superadmin.from('user_documents').select('id').eq('org_id', orgA)).data?.length).toBe(1);
  });

  it('logo: solo lo sube el admin de esa empresa', async () => {
    const png = new Blob([Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10])], { type: 'image/png' });
    expect((await adminA.storage.from('org-logos').upload(`${orgA}/logo.png`, png, { upsert: true })).error).toBeNull();
    expect((await userA.storage.from('org-logos').upload(`${orgA}/user.png`, png)).error).not.toBeNull();
    expect((await adminB.storage.from('org-logos').upload(`${orgA}/b.png`, png)).error).not.toBeNull();
  });

  it('al quitar a alguien de la empresa pierde el acceso (también a sus chats)', async () => {
    const removed = await callFunction(adminA, 'manage-members', { action: 'remove', org_id: orgA, user_id: ids.userA });
    expect(removed.status).toBe(200);
    expect((await userA.from('user_documents').select('id')).data).toEqual([]);
    expect((await userA.from('chat_messages').select('id')).data).toEqual([]);
    const chat = await callFunction(userA, 'chat-with-document', { query: 'x', sessionId: `s-${uniq()}`, documentId: docA.id });
    expect(chat.status).toBe(404);
  });
});
