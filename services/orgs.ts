import { AppError, functionErrorBody, supabase } from './supabase';

export type Role = 'admin' | 'user';

export const SPECIALTIES = ['general', 'electrical', 'civil', 'mechanical', 'plumbing', 'architecture'] as const;
export type Specialty = (typeof SPECIALTIES)[number];

export interface Org {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  specialty: Specialty;
  assistant_instructions: string;
}

export interface Membership {
  org_id: string;
  role: Role;
}

export interface Member {
  user_id: string;
  email: string;
  role: Role;
  created_at: string;
  last_sign_in_at: string | null;
}

export interface Access {
  isSuperadmin: boolean;
  memberships: Membership[];
  orgs: Org[];
}

function check<T>(res: { data: T; error: { message: string } | null }, code = 'generic'): T {
  if (res.error) throw new AppError(code, res.error.message);
  return res.data;
}

/** Superadmin, empresas a las que pertenece y rol en cada una. */
export async function loadAccess(userId: string): Promise<Access> {
  const sb = supabase();
  const [superRes, memRes, orgRes] = await Promise.all([
    sb.rpc('is_superadmin'),
    sb.from('memberships').select('org_id, role').eq('user_id', userId),
    sb.from('organizations').select('id, name, slug, logo_url, specialty, assistant_instructions').order('name'),
  ]);
  return {
    isSuperadmin: Boolean(superRes.data),
    memberships: check(memRes) as Membership[],
    orgs: check(orgRes) as Org[],
  };
}

async function manage(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { data, error } = await supabase().functions.invoke('manage-members', { body });
  if (error) {
    const detail = await functionErrorBody(error);
    throw new AppError(detail?.code || 'generic', detail?.error || error.message);
  }
  return data as Record<string, unknown>;
}

export async function listMembers(orgId: string): Promise<Member[]> {
  return check(await supabase().rpc('org_members', { p_org: orgId }), 'forbidden') as Member[];
}

export const inviteMember = (orgId: string, email: string, role: Role) => manage({ action: 'invite', org_id: orgId, email, role });
export const setMemberRole = (orgId: string, userId: string, role: Role) => manage({ action: 'set_role', org_id: orgId, user_id: userId, role });
export const removeMember = (orgId: string, userId: string) => manage({ action: 'remove', org_id: orgId, user_id: userId });
export const createOrg = (name: string, slug: string, adminEmail: string, specialty: Specialty) =>
  manage({ action: 'create_org', name, slug, admin_email: adminEmail, specialty });

export type OrgPatch = Partial<Pick<Org, 'name' | 'logo_url' | 'specialty' | 'assistant_instructions'>>;

export async function updateOrg(orgId: string, patch: OrgPatch): Promise<void> {
  const res = await supabase().from('organizations').update(patch).eq('id', orgId).select('id');
  if (!check(res, 'forbidden')?.length) throw new AppError('forbidden');
}

const LOGO_TYPES: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
export const MAX_LOGO_BYTES = 1024 * 1024;

/** Sube el logo al bucket público org-logos/{org_id}/ y devuelve su URL. */
export async function uploadLogo(orgId: string, file: File): Promise<string> {
  const ext = LOGO_TYPES[file.type];
  if (!ext || file.size > MAX_LOGO_BYTES) throw new AppError('logoTooLarge');
  const path = `${orgId}/logo-${Date.now()}.${ext}`;
  const bucket = supabase().storage.from('org-logos');
  const { error } = await bucket.upload(path, file, { contentType: file.type, upsert: true });
  if (error) throw new AppError('forbidden', error.message);
  return bucket.getPublicUrl(path).data.publicUrl;
}
