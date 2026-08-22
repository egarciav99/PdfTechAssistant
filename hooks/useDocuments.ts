import { useState, useEffect, useCallback } from 'react';
import { 
  getUserDocuments,
  deleteUserDocument,
  uploadFileToSupabase,
  addNewDocumentToUser,
  getDocumentSummary,
  processDocument,
} from '../services/supabase';
import type { DocumentItem, ResumenDocument } from '../types';

interface UseDocumentsReturn {
  documents: DocumentItem[];
  isLoading: boolean;
  error: string | null;
  uploadDocument: (file: File, userId: string) => Promise<void>;
  deleteDocument: (doc: DocumentItem, userId: string) => Promise<void>;
  fetchSummary: (documentId: string) => Promise<ResumenDocument | null>;
  clearError: () => void;
}

export const useDocuments = (userId: string | null): UseDocumentsReturn => {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load the authenticated user's documents through RLS.
  useEffect(() => {
    if (!userId) {
      setDocuments([]);
      return;
    }
    setIsLoading(true);
    getUserDocuments(userId)
      .then((docs) => {
        setDocuments(docs);
        setIsLoading(false);
      })
      .catch(() => {
        setError('Failed to fetch documents');
        setIsLoading(false);
      });
  }, [userId]);

  const clearError = useCallback(() => setError(null), []);

  const uploadDocument = useCallback(async (file: File, uid: string): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      // 1. Upload to Storage
      const storageId = await uploadFileToSupabase(file, uid);

      // 2. Add relational document metadata
      const newDoc = await addNewDocumentToUser(uid, {
        name: file.name,
        storageId: storageId,
      });

      // 3. Update local state immediately so the UI reflects the new document
      if (newDoc) {
        setDocuments(prev => [newDoc as DocumentItem, ...prev]);
        await processDocument(newDoc.id);
      }

      // Processing runs through the Supabase Edge Function after upload.
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed.';
      setError(message);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const deleteDocument = useCallback(async (doc: DocumentItem, uid: string): Promise<void> => {
    try {
      await deleteUserDocument(uid, doc.id, doc.storageId);
      // Update local state immediately so the UI reflects the deletion
      setDocuments(prev => prev.filter(d => d.id !== doc.id));
    } catch (err) {
      const message = 'Could not delete document. Please try again.';
      setError(message);
      throw new Error(message);
    }
  }, []);

  const fetchSummary = useCallback(async (documentId: string): Promise<ResumenDocument | null> => {
    try {
      return await getDocumentSummary(documentId);
    } catch (err) {
      return null;
    }
  }, []);

  return {
    documents,
    isLoading,
    error,
    uploadDocument,
    deleteDocument,
    fetchSummary,
    clearError
  };
};

export default useDocuments;
