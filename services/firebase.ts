
import { initializeApp } from "firebase/app";
import { getStorage, ref, uploadBytes, deleteObject } from "firebase/storage";
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut,
  onAuthStateChanged
} from "firebase/auth";
import { getFirestore, doc, setDoc, updateDoc, getDoc, deleteDoc, onSnapshot, arrayUnion } from "firebase/firestore";
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
    console.log('Uploaded file to root:', storageName);
    return storageName;
  } catch (error) {
    console.error("Error uploading file to Firebase Storage:", error);
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
      await setDoc(userRef, {
        documents: [], // Initialize as empty array
      });
    }
  } catch (error) {
    console.error("Error creating user document:", error);
  }
};

/**
 * Subscribes to the user's document changes in Firestore.
 */
export const subscribeToUserDocuments = (uid: string, callback: (docs: DocumentItem[]) => void) => {
  const userRef = doc(db, 'users', uid);
  return onSnapshot(userRef, (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      callback(data.documents || []);
    } else {
      callback([]);
    }
  });
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
            console.warn(`Permission denied accessing summary for ${storageId}. Please verify Firestore Rules for 'resumenes' collection allow reading IDs starting with UID.`);
            return null;
        }
        console.error("Error fetching summary:", error);
        return null;
    }
};

/**
 * Adds a new document metadata to the user's Firestore document list.
 * Calculates the next ID (01, 02, etc.) based on existing length.
 */
export const addNewDocumentToUser = async (uid: string, fileData: { name: string, storageId: string }) => {
    if (!uid) return;
    const userRef = doc(db, 'users', uid);
    
    try {
        const docSnap = await getDoc(userRef);
        let currentDocs: DocumentItem[] = [];
        
        if (docSnap.exists()) {
            currentDocs = docSnap.data().documents || [];
        } else {
            // Create doc if missing
            await setDoc(userRef, { documents: [] });
        }

        // Calculate next ID
        const nextIdNumber = currentDocs.length + 1;
        const nextId = nextIdNumber.toString().padStart(2, '0');

        const newDocItem: DocumentItem = {
            id: nextId,
            nombreDocumento: fileData.name,
            storageId: fileData.storageId,
            createdAt: Date.now(),
        };

        await updateDoc(userRef, {
            documents: arrayUnion(newDocItem)
        });
        
        return newDocItem;
    } catch (error) {
        console.error("Error adding new document to user:", error);
        throw error;
    }
};

/**
 * Deletes a document from Firestore array, the file from Storage, and the summary from Firestore.
 */
export const deleteUserDocument = async (uid: string, docId: string, storageId: string) => {
  if (!uid || !docId) return;

  // 1. Delete from Storage
  if (storageId) {
    const fileRef = ref(storage, storageId);
    try {
      await deleteObject(fileRef);
    } catch (error) {
      console.warn("Could not delete file from storage (might not exist):", error);
    }
    
    // 1.1 Delete separate Summary document if exists
    try {
        const summaryRef = doc(db, 'resumenes', storageId);
        await deleteDoc(summaryRef);
    } catch (e) { 
        console.warn("Could not delete summary document:", e);
    }
  }

  // 2. Remove from Firestore array (Users collection)
  const userRef = doc(db, 'users', uid);
  try {
    const docSnap = await getDoc(userRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      const currentDocs: DocumentItem[] = data.documents || [];
      const updatedDocs = currentDocs.filter(d => d.id !== docId);
      
      await updateDoc(userRef, {
        documents: updatedDocs
      });
    }
  } catch (error) {
    console.error("Error deleting document reference:", error);
    throw error;
  }
};

export { 
  auth, 
  db, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut,
  onAuthStateChanged
};
