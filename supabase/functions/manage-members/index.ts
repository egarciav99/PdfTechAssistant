/**
 * Gestión de usuarios y empresas (necesita service role para Auth).
 *
 * Acciones (JSON con la sesión del usuario en Authorization):
 *   · invite     { org_id, email, role }                     admin de la empresa o superadmin
 *   · set_role   { org_id, user_id, role }                   admin de la empresa o superadmin
 *   · remove     { org_id, user_id }                         admin de la empresa o superadmin
 *   · create_org { name, slug, admin_email, specialty? }     solo superadmin
 * Nunca deja una empresa sin al menos un admin.
 */
/// <reference path="../types.d.ts" />
import { authenticate, corsHeaders, json, serviceClient, UUID_RE } from '../_shared/common.ts';
import { isSpecialty } from '../_shared/prompts.ts';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES = new Set(['admin', 'user']);

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) });
  if (req.method !== 'POST') return json(req, { error: 'Method not allowed' }, 405);

  const auth = await authenticate(req);
  if (!auth) return json(req, { error: 'Unauthorized', code: 'unauthorized' }, 401);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(req, { error: 'Invalid request', code: 'invalid_request' }, 400);
  }
  const action = String(body.action || '');
  const admin = serviceClient();
  const redirectTo = Deno.env.get('PDF_APP_URL') || req.headers.get('origin') || undefined;

  const { data: isSuper } = await auth.userClient.rpc('is_superadmin');

  /** Invita por correo o, si la cuenta ya existe, la reutiliza. Devuelve el id del usuario. */
  async function ensureUser(email: string): Promise<string> {
    const normalized = email.trim().toLowerCase();
    const { data, error } = await admin.auth.admin.inviteUserByEmail(normalized, { redirectTo });
    if (!error && data?.user) return data.user.id;
    for (let page = 1; page <= 50; page++) {
      const { data: list } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      const found = list?.users.find((u: { email?: string }) => u.email?.toLowerCase() === normalized);
      if (found) return found.id;
      if (!list || list.users.length < 200) break;
    }
    throw error ?? new Error('Could not invite user');
  }

  async function adminCount(orgId: string): Promise<number> {
    const { count } = await admin.from('memberships').select('user_id', { count: 'exact', head: true })
      .eq('org_id', orgId).eq('role', 'admin');
    return count ?? 0;
  }

  try {
    if (action === 'create_org') {
      if (!isSuper) return json(req, { error: 'Only the superadmin can create companies', code: 'forbidden' }, 403);
      const name = String(body.name || '').trim();
      const slug = String(body.slug || '').trim().toLowerCase();
      const adminEmail = String(body.admin_email || '').trim();
      const specialty = body.specialty === undefined ? 'general' : body.specialty;
      if (!name || name.length > 120 || !/^[a-z0-9-]{2,60}$/.test(slug) || !EMAIL_RE.test(adminEmail) || !isSpecialty(specialty)) {
        return json(req, { error: 'Invalid name, identifier, email or specialty', code: 'invalid_org' }, 400);
      }
      const { data: org, error } = await admin.from('organizations').insert({ name, slug, specialty }).select().single();
      if (error) {
        return error.code === '23505'
          ? json(req, { error: 'That identifier already exists', code: 'slug_taken' }, 409)
          : json(req, { error: 'Could not create the company', code: 'invalid_org' }, 400);
      }
      try {
        const userId = await ensureUser(adminEmail);
        const { error: memError } = await admin.from('memberships').upsert({ org_id: org.id, user_id: userId, role: 'admin' });
        if (memError) throw memError;
      } catch (err) {
        // Sin admin la empresa quedaría huérfana: se deshace.
        await admin.from('organizations').delete().eq('id', org.id);
        throw err;
      }
      return json(req, { org });
    }

    const orgId = String(body.org_id || '');
    if (!UUID_RE.test(orgId)) return json(req, { error: 'Invalid company', code: 'invalid_org' }, 400);
    const { data: canManage } = await auth.userClient.rpc('is_org_admin', { p_org: orgId });
    if (!canManage) return json(req, { error: 'You have no permissions in this company', code: 'forbidden' }, 403);

    if (action === 'invite') {
      const email = String(body.email || '');
      const role = String(body.role || 'user');
      if (!EMAIL_RE.test(email) || !ROLES.has(role)) return json(req, { error: 'Invalid email or role', code: 'invalid_member' }, 400);
      const userId = await ensureUser(email);
      // Si ya era admin, invitarle como usuario no le baja el rol sin querer.
      const { data: current } = await admin.from('memberships').select('role').eq('org_id', orgId).eq('user_id', userId).maybeSingle();
      if (current) return json(req, { user_id: userId, already_member: true });
      const { error } = await admin.from('memberships').insert({ org_id: orgId, user_id: userId, role });
      if (error) throw error;
      return json(req, { user_id: userId });
    }

    const userId = String(body.user_id || '');
    if (!UUID_RE.test(userId)) return json(req, { error: 'Invalid user', code: 'invalid_member' }, 400);
    const { data: current } = await admin.from('memberships').select('role').eq('org_id', orgId).eq('user_id', userId).maybeSingle();
    if (!current) return json(req, { error: 'That user does not belong to the company', code: 'not_member' }, 404);

    if (action === 'set_role') {
      const role = String(body.role || '');
      if (!ROLES.has(role)) return json(req, { error: 'Invalid role', code: 'invalid_member' }, 400);
      if (current.role === 'admin' && role !== 'admin' && (await adminCount(orgId)) <= 1) {
        return json(req, { error: 'The company needs at least one admin', code: 'last_admin' }, 409);
      }
      await admin.from('memberships').update({ role }).eq('org_id', orgId).eq('user_id', userId);
      return json(req, { ok: true });
    }

    if (action === 'remove') {
      if (current.role === 'admin' && (await adminCount(orgId)) <= 1) {
        return json(req, { error: 'The company needs at least one admin', code: 'last_admin' }, 409);
      }
      await admin.from('memberships').delete().eq('org_id', orgId).eq('user_id', userId);
      return json(req, { ok: true });
    }

    return json(req, { error: 'Invalid action', code: 'invalid_request' }, 400);
  } catch (_err) {
    const referenceId = crypto.randomUUID();
    console.error(`[manage-members] failed reference=${referenceId}`);
    return json(req, { error: `Could not complete the action; reference=${referenceId}`, code: 'server_error' }, 500);
  }
});
