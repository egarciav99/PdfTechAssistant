import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

interface LocalEnv {
  url: string;
  anonKey: string;
  serviceKey: string;
}

let cached: LocalEnv | null = null;

/** Claves del Supabase local (de las variables de entorno o de `supabase status`). */
export function localEnv(): LocalEnv {
  if (cached) return cached;
  if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    cached = { url: process.env.SUPABASE_URL, anonKey: process.env.SUPABASE_ANON_KEY, serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY };
    return cached;
  }
  const out = execSync('npx supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  const status = JSON.parse(out.slice(out.indexOf('{')));
  cached = { url: status.API_URL, anonKey: status.ANON_KEY, serviceKey: status.SERVICE_ROLE_KEY };
  return cached;
}

export const GEMINI_MOCK_URL = process.env.GEMINI_MOCK_URL || 'http://127.0.0.1:54399';

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

export function serviceClient(): SupabaseClient {
  const env = localEnv();
  return createClient(env.url, env.serviceKey, noSession);
}

export function anonClient(): SupabaseClient {
  const env = localEnv();
  return createClient(env.url, env.anonKey, noSession);
}

export const PASSWORD = 'Prueba-1234!';

/** Crea (o reutiliza) un usuario confirmado con contraseña conocida. */
export async function ensureUser(email: string): Promise<string> {
  const admin = serviceClient();
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (!error && data.user) return data.user.id;
  const { data: list } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const found = list.users.find((u) => u.email === email);
  if (!found) throw error ?? new Error(`No se pudo crear ${email}`);
  await admin.auth.admin.updateUserById(found.id, { password: PASSWORD, email_confirm: true });
  return found.id;
}

export async function signIn(email: string): Promise<SupabaseClient> {
  const client = anonClient();
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw error;
  return client;
}

/** Llama a una Edge Function y devuelve estado y cuerpo JSON (sin lanzar en 4xx/5xx). */
export async function callFunction(client: SupabaseClient, name: string, body: unknown): Promise<{ status: number; body: any }> {
  const { data } = await client.auth.getSession();
  const env = localEnv();
  const res = await fetch(`${env.url}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: env.anonKey,
      Authorization: `Bearer ${data.session?.access_token ?? env.anonKey}`,
    },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

export const samplePdf = (): Buffer => readFileSync(new URL('../fixtures/especificacion.pdf', import.meta.url));

/** Sube el PDF de prueba como `client` a la empresa y crea la fila del documento. */
export async function uploadDocument(client: SupabaseClient, orgId: string, name = 'especificacion.pdf'): Promise<{ id: string; storage_path: string }> {
  const { data: auth } = await client.auth.getUser();
  const path = `${orgId}/${auth.user!.id}/${Date.now()}_${Math.random().toString(16).slice(2)}_${name}`;
  const up = await client.storage.from('documents').upload(path, samplePdf(), { contentType: 'application/pdf' });
  if (up.error) throw up.error;
  const { data, error } = await client
    .from('user_documents')
    .insert({ org_id: orgId, user_id: auth.user!.id, original_name: name, storage_path: path, status: 'uploaded' })
    .select('id, storage_path')
    .single();
  if (error) throw error;
  return data;
}

export const uniq = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
