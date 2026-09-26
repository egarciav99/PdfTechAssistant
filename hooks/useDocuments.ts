import { useState, useEffect, useCallback, useRef } from 'react';
import {
  AppError,
  addDocumentToOrg,
  deleteDocument as deleteDocumentRequest,
  getDocumentSummary,
  getOrgDocuments,
  processDocument,
  uploadFileToSupabase,
} from '../services/supabase';
import { currentLanguage } from '../i18n';
import type { DocumentItem, ResumenDocument } from '../types';

export const MAX_PDF_BYTES = 50 * 1024 * 1024;

interface UseDocumentsReturn {
  documents: DocumentItem[];
  isLoading: boolean;
  /** Clave de traducción (errors.* o documents.*) del último error. */
  error: string | null;
  uploadDocument: (file: File) => Promise<void>;
  deleteDocument: (doc: DocumentItem) => Promise<void>;
  retryDocument: (doc: DocumentItem) => Promise<void>;
  fetchSummary: (documentId: string) => Promise<ResumenDocument | null>;
  reload: () => Promise<void>;
  clearError: () => void;
}

const DOCUMENT_ERRORS = new Set(['loadError', 'deleteError', 'uploadError', 'processError']);
const errorKey = (err: unknown, fallback: string) => {
  const code = err instanceof AppError ? err.code : fallback;
  return DOCUMENT_ERRORS.has(code) ? `documents.${code}` : `errors.${code}`;
};

export const useDocuments = (orgId: string | null, userId: string | null): UseDocumentsReturn => {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const uploadInFlightRef = useRef(false);

  const reload = useCallback(async () => {
    if (!orgId || !userId) {
      setDocuments([]);
      return;
    }
    try {
      setDocuments(await getOrgDocuments(orgId));
    } catch {
      setError('documents.loadError');
    }
  }, [orgId, userId]);

  // Documentos de la empresa actual (RLS por empresa).
  useEffect(() => {
    setDocuments([]);
    if (!orgId || !userId) return;
    setIsLoading(true);
    reload().finally(() => setIsLoading(false));
  }, [orgId, userId, reload]);

  // Mientras haya documentos procesándose, se refresca la lista.
  const hasPending = documents.some((d) => d.status === 'processing' || d.status === 'uploaded');
  useEffect(() => {
    if (!hasPending) return;
    const timer = window.setInterval(() => { reload(); }, 5000);
    return () => window.clearInterval(timer);
  }, [hasPending, reload]);

  const clearError = useCallback(() => setError(null), []);

  const uploadDocument = useCallback(async (file: File): Promise<void> => {
    if (uploadInFlightRef.current || !orgId || !userId) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('upload.onlyPdf');
      throw new Error('upload.onlyPdf');
    }
    if (file.size > MAX_PDF_BYTES) {
      setError('upload.tooLarge');
      throw new Error('upload.tooLarge');
    }
    uploadInFlightRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      const storageId = await uploadFileToSupabase(file, orgId, userId);
      const newDoc = await addDocumentToOrg(orgId, userId, { name: file.name, storageId });
      setDocuments((prev) => [newDoc, ...prev.filter((d) => d.id !== newDoc.id)]);
      if (newDoc.status === 'uploaded' || newDoc.status === 'error') {
        await processDocument(newDoc.id, currentLanguage());
      }
      await reload();
    } catch (err) {
      setError(errorKey(err, 'uploadError'));
      await reload();
      throw err;
    } finally {
      uploadInFlightRef.current = false;
      setIsLoading(false);
    }
  }, [orgId, userId, reload]);

  const retryDocument = useCallback(async (doc: DocumentItem): Promise<void> => {
    setError(null);
    setDocuments((prev) => prev.map((d) => (d.id === doc.id ? { ...d, status: 'processing' } : d)));
    try {
      await processDocument(doc.id, currentLanguage());
    } catch (err) {
      setError(errorKey(err, 'processError'));
    } finally {
      await reload();
    }
  }, [reload]);

  const deleteDocument = useCallback(async (doc: DocumentItem): Promise<void> => {
    try {
      await deleteDocumentRequest(doc.id, doc.storageId);
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
    } catch (err) {
      setError('documents.deleteError');
      throw err;
    }
  }, []);

  const fetchSummary = useCallback(async (documentId: string): Promise<ResumenDocument | null> => {
    try {
      return await getDocumentSummary(documentId);
    } catch {
      return null;
    }
  }, []);

  return { documents, isLoading, error, uploadDocument, deleteDocument, retryDocument, fetchSummary, reload, clearError };
};

export default useDocuments;
