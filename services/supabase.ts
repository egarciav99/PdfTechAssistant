import { createClient } from '@supabase/supabase-js';
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import { SUPABASE_CONFIG } from '../constants';
import type { DocumentItem, ResumenDocument } from '../types';

export const supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);

export const auth = supabase.auth;

export const signInWithEmailAndPassword = (email: string, password: string) =>
  supabase.auth.signInWithPassword({ email, password });

export const createUserWithEmailAndPassword = (email: string, password: string) =>
  supabase.auth.signUp({ email, password });

export const signOut = () => supabase.auth.signOut();

export const onAuthStateChanged = (
  callback: (event: AuthChangeEvent, session: Session | null) => void,
) => supabase.auth.onAuthStateChange(callback);

export const createUserDocument = async (user: User): Promise<void> => {
  const { error } = await supabase.from('profiles').upsert({
    id: user.id,
    email: user.email,
  });

  if (error && error.code !== '42P01') {
    throw new Error(`Failed to initialize user profile: ${error.message}`);
  }
};

export const getUserDocuments = async (uid: string): Promise<DocumentItem[]> => {
  const { data, error } = await supabase
    .from('user_documents')
    .select('id, original_name, storage_path, created_at, status')
    .eq('user_id', uid)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to fetch documents: ${error.message}`);

  return (data || []).map((document) => ({
    id: document.id,
    nombreDocumento: document.original_name,
    storageId: document.storage_path,
    createdAt: new Date(document.created_at).getTime(),
    status: document.status,
  }));
};

export const uploadFileToSupabase = async (file: File, uid: string): Promise<string> => {
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${uid}/${crypto.randomUUID()}_${sanitizedName}`;
  const { error } = await supabase.storage.from('documents').upload(storagePath, file, {
    contentType: file.type || 'application/pdf',
    upsert: false,
  });

  if (error) throw new Error(`Could not upload file: ${error.message}`);
  return storagePath;
};

export const addNewDocumentToUser = async (
  uid: string,
  fileData: { name: string; storageId: string },
): Promise<DocumentItem> => {
  const { data, error } = await supabase
    .from('user_documents')
    .insert({
      user_id: uid,
      original_name: fileData.name,
      storage_path: fileData.storageId,
      status: 'uploaded',
    })
    .select('id, original_name, storage_path, created_at, status')
    .single();

  if (error || !data) throw new Error(`Could not create document: ${error?.message || 'unknown error'}`);

  return {
    id: data.id,
    nombreDocumento: data.original_name,
    storageId: data.storage_path,
    createdAt: new Date(data.created_at).getTime(),
    status: data.status,
  };
};

export const deleteUserDocument = async (uid: string, documentId: string, storageId: string) => {
  const { error: documentError } = await supabase
    .from('user_documents')
    .delete()
    .eq('id', documentId)
    .eq('user_id', uid);

  if (documentError) throw new Error(`Could not delete document: ${documentError.message}`);

  const { error: storageError } = await supabase.storage.from('documents').remove([storageId]);
  if (storageError) console.warn('Storage delete failed:', storageError.message);
};

export const getDocumentSummary = async (documentId: string): Promise<ResumenDocument | null> => {
  const { data, error } = await supabase
    .from('summaries')
    .select('document_id, user_id, content, created_at')
    .eq('document_id', documentId)
    .maybeSingle();

  if (error) throw new Error(`Failed to fetch summary: ${error.message}`);
  if (!data) return null;

  return {
    uid: data.user_id,
    Id_documento: data.document_id,
    fileName: data.document_id,
    resumen: data.content,
  };
};

export const processDocument = async (documentId: string): Promise<void> => {
  const { error } = await supabase.functions.invoke('process-document', {
    body: { documentId },
  });

  if (error) throw new Error(`Could not process document: ${error.message}`);
};

export { User };
