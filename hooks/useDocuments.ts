import { useState, useEffect, useCallback } from 'react';
import { 
  getUserDocuments,
  deleteUserDocument as firebaseDeleteDocument,
  uploadFileToFirebase,
  addNewDocumentToUser,
  getDocumentSummary
} from '../services/firebase';
import { FIREBASE_CONFIG } from '../constants';
import type { DocumentItem, ResumenDocument } from '../types';

interface UseDocumentsReturn {
  documents: DocumentItem[];
  isLoading: boolean;
  error: string | null;
  uploadDocument: (file: File, userId: string) => Promise<void>;
  deleteDocument: (doc: DocumentItem, userId: string) => Promise<void>;
  fetchSummary: (storageId: string) => Promise<ResumenDocument | null>;
  clearError: () => void;
}

export const useDocuments = (userId: string | null): UseDocumentsReturn => {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lectura puntual de los documentos del usuario (subcolección)
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
      const storageId = await uploadFileToFirebase(file);

      // 2. Add metadata to Firestore
      const newDoc = await addNewDocumentToUser(uid, {
        name: file.name,
        storageId: storageId,
      });

      // 3. Document processing is now automatic via Firebase Storage trigger (processDocument.ts)
      // No manual webhook call needed.
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
      await firebaseDeleteDocument(uid, doc.id, doc.storageId);
    } catch (err) {
      const message = 'Could not delete document. Please try again.';
      setError(message);
      throw new Error(message);
    }
  }, []);

  const fetchSummary = useCallback(async (storageId: string): Promise<ResumenDocument | null> => {
    try {
      return await getDocumentSummary(storageId);
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
