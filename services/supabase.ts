import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getConfig } from '../config';
import type { ChatMessage, DocumentItem, ResumenDocument } from '../types';

let client: SupabaseClient | null = null;

/** Cliente único, creado con la configuración cargada de config.json. */
export function supabase(): SupabaseClient {
  if (!client) {
    const { url, anonKey } = getConfig().supabase;
    client = createClient(url, anonKey, { auth: { persistSession: true, detectSessionInUrl: true } });
  }
  return client;
}

/** Error con un código traducible (clave de errors.* en locales). */
export class AppError extends Error {
  code: string;

  constructor(code: string, message?: string) {
    super(message || code);
    this.code = code;
  }
}

/** Saca el cuerpo JSON de un error de functions.invoke. */
export async function functionErrorBody(error: unknown): Promise<{ error?: string; code?: string } | null> {
  const context = (error as { context?: unknown })?.context;
  if (context instanceof Response) {
    try {
      return await context.clone().json();
    } catch {
      return null;
    }
  }
  return null;
}

const DOCUMENT_COLUMNS = 'id, org_id, user_id, original_name, storage_path, created_at, status';

interface DocumentRow {
  id: string;
  org_id: string;
  user_id: string;
  original_name: string;
  storage_path: string;
  created_at: string;
  status: DocumentItem['status'];
}

const toDocument = (row: DocumentRow): DocumentItem => ({
  id: row.id,
  orgId: row.org_id,
  uploadedBy: row.user_id,
  nombreDocumento: row.original_name,
  storageId: row.storage_path,
  createdAt: new Date(row.created_at).getTime(),
  status: row.status,
});

/** Documentos de la empresa (RLS: solo si el usuario pertenece a ella). */
export const getOrgDocuments = async (orgId: string): Promise<DocumentItem[]> => {
  const { data, error } = await supabase()
    .from('user_documents')
    .select(DOCUMENT_COLUMNS)
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  if (error) throw new AppError('loadError', error.message);
  return ((data || []) as DocumentRow[]).map(toDocument);
};

/** Sube el PDF a {org_id}/{user_id}/{hash}_{nombre}. */
export const uploadFileToSupabase = async (file: File, orgId: string, uid: string): Promise<string> => {
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const fileBytes = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', fileBytes);
  const hash = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  const storagePath = `${orgId}/${uid}/${hash}_${sanitizedName}`;
  const { error } = await supabase().storage.from('documents').upload(storagePath, file, {
    contentType: 'application/pdf',
    upsert: false,
  });

  // El mismo archivo ya subido por esta persona: se reutiliza.
  const duplicate = error && /exists|duplicate/i.test(error.message);
  if (error && !duplicate) throw new AppError('uploadError', error.message);
  return storagePath;
};

export const addDocumentToOrg = async (
  orgId: string,
  uid: string,
  fileData: { name: string; storageId: string },
): Promise<DocumentItem> => {
  const sb = supabase();
  const { data, error } = await sb
    .from('user_documents')
    .insert({
      org_id: orgId,
      user_id: uid,
      original_name: fileData.name,
      storage_path: fileData.storageId,
      status: 'uploaded',
    })
    .select(DOCUMENT_COLUMNS)
    .single();

  if (error || !data) {
    const { data: existingDocument } = await sb
      .from('user_documents')
      .select(DOCUMENT_COLUMNS)
      .eq('org_id', orgId)
      .eq('storage_path', fileData.storageId)
      .maybeSingle();

    if (existingDocument) return toDocument(existingDocument as DocumentRow);

    await sb.storage.from('documents').remove([fileData.storageId]);
    throw new AppError('uploadError', error?.message);
  }

  return toDocument(data as DocumentRow);
};

/**
 * Borra primero el archivo y después la fila: los archivos anteriores a la
 * migración multiempresa se autorizan a través de esa fila.
 */
export const deleteDocument = async (documentId: string, storageId: string) => {
  const sb = supabase();
  const { error: storageError } = await sb.storage.from('documents').remove([storageId]);
  if (storageError) console.warn('Storage delete failed:', storageError.message);

  const { data, error } = await sb.from('user_documents').delete().eq('id', documentId).select('id');
  if (error || !data?.length) throw new AppError('deleteError', error?.message);
};

export const getDocumentSummary = async (documentId: string): Promise<ResumenDocument | null> => {
  const { data, error } = await supabase()
    .from('summaries')
    .select('document_id, user_id, content, created_at')
    .eq('document_id', documentId)
    .maybeSingle();

  if (error) throw new AppError('generic', error.message);
  if (!data) return null;

  return {
    uid: data.user_id,
    Id_documento: data.document_id,
    fileName: data.document_id,
    resumen: data.content,
  };
};

export const processDocument = async (documentId: string, lang: string): Promise<void> => {
  const { data, error } = await supabase().functions.invoke('process-document', {
    body: { documentId, lang },
  });

  if (error) {
    const body = await functionErrorBody(error);
    throw new AppError('processError', body?.error || error.message);
  }

  if (data?.error) throw new AppError('processError', data.error);
};

/** Mensajes guardados de una conversación propia (RLS: solo las del usuario). */
export const getChatHistory = async (sessionId: string): Promise<ChatMessage[]> => {
  const { data } = await supabase()
    .from('chat_messages')
    .select('role, content')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
    .limit(100);
  return (data || []).map((m: { role: string; content: string }) => ({
    sender: m.role === 'assistant' ? 'bot' : 'user',
    text: m.content,
  }));
};
