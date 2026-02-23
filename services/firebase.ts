
import { initializeApp } from "firebase/app";
import { getStorage, ref, uploadBytes, deleteObject } from "firebase/storage";
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut,
  onAuthStateChanged
} from "firebase/auth";
import { getFirestore, doc, setDoc, updateDoc, getDoc, deleteDoc, onSnapshot, arrayUnion, collection, addDoc, getDocs, query, orderBy, where, runTransaction } from "firebase/firestore";
import { FIREBASE_CONFIG } from '../constants';
import type { DocumentItem, ResumenDocument } from '../types';

// Initialize Firebase
const firebaseApp = initializeApp(FIREBASE_CONFIG);

// Services
const storage = getStorage(firebaseApp);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

/**
 * Uploads a file to Firebase Storage in the root bucket using a prefixed name.
 * Format: UID_OriginalName.ext
 * @param file The file to upload.
 * @returns The specific file name in the root bucket.
 */
export const uploadFileToFirebase = async (file: File): Promise<string> => {
  if (!file) {
    throw new Error("No file provided for upload.");
  }
  
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("User must be logged in to upload files.");
  }

  // Sanitize filename to ensure valid Firestore ID characters later
  // Replaces anything that isn't alphanumeric, dot, underscore, or hyphen with an underscore.
  const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storageName = `${currentUser.uid}_${sanitizedFileName}`;
  const storageRef = ref(storage, storageName);

  try {
    await uploadBytes(storageRef, file);
    return storageName;
  } catch (error) {
    throw new Error("Could not upload file to storage. Check permissions.");
  }
};

/**
 * Creates a new user document in Firestore if it doesn't exist.
 */
export const createUserDocument = async (uid: string) => {
  if (!uid) return;
  const userRef = doc(db, 'users', uid);
  try {
    const docSnap = await getDoc(userRef);
    if (!docSnap.exists()) {
      await setDoc(userRef, {}); // No array, just empty user doc
    }
  } catch (error) {
    // Silently fail - user doc creation is non-critical
  }
};

/**
 * Obtiene todos los documentos del usuario desde la subcolección 'documents'.
 */
export const getUserDocuments = async (uid: string): Promise<DocumentItem[]> => {
  if (!uid) return [];
  const docsCol = collection(db, 'users', uid, 'documents');
  const q = query(docsCol, orderBy('createdAt', 'desc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as DocumentItem[];
};

/**
 * Fetch a summary from the 'resumenes' collection.
 * Uses storageId as the document ID (which is the Storage Filename including UID).
 * Expected fields in document: uid, Id_documento, fileName, resumen.
 */
export const getDocumentSummary = async (storageId: string): Promise<ResumenDocument | null> => {
    if (!storageId) return null;
    
    // El ID del documento en la colección 'resumenes' es exactamente el nombre del archivo en Storage (ej: UID_archivo.pdf)
    const summaryRef = doc(db, 'resumenes', storageId);
    
    try {
        const docSnap = await getDoc(summaryRef);
        if (docSnap.exists()) {
            return docSnap.data() as ResumenDocument;
        }
        return null;
    } catch (error: any) {
        // Handle permissions error gracefully
        if (error.code === 'permission-denied') {
            return null;
        }
        return null;
    }
};

/**
 * Agrega un nuevo documento a la subcolección 'documents' del usuario.
 */
  if (!uid) return;
  const docsCol = collection(db, 'users', uid, 'documents');
  const newDocItem: Omit<DocumentItem, 'id'> = {
    nombreDocumento: fileData.name,
    storageId: fileData.storageId,
    createdAt: Date.now(),
  };
  // Usar transacción para asegurar consistencia
  let docId = '';
  await runTransaction(db, async (transaction) => {
    const docRef = doc(docsCol);
    transaction.set(docRef, newDocItem);
    docId = docRef.id;
  });
  return { ...newDocItem, id: docId };
};

/**
 * Elimina un documento de la subcolección 'documents', el archivo de Storage y el resumen.
 */
export const deleteUserDocument = async (uid: string, docId: string, storageId: string) => {
  if (!uid || !docId) return;

  // Usar transacción para borrar el documento de Firestore y el resumen solo si el borrado de Storage fue exitoso
  const docRef = doc(db, 'users', uid, 'documents', docId);
  await runTransaction(db, async (transaction) => {
    // 1. Delete from Storage (fuera de la transacción, pero si falla, aborta)
    if (storageId) {
      const fileRef = ref(storage, storageId);
      try {
        await deleteObject(fileRef);
      } catch (error) {
        throw new Error('No se pudo borrar el archivo de Storage');
      }
      // 1.1 Delete separate Summary document if exists
      try {
        const summaryRef = doc(db, 'resumenes', storageId);
        transaction.delete(summaryRef);
      } catch (e) {
        // Summary might not exist, continuar
      }
    }
    // 2. Remove document from subcollection
    transaction.delete(docRef);
  });
};

export { 
  auth, 
  db, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut,
  onAuthStateChanged
};
