
import type { User } from 'firebase/auth';

export type AppState = 'dashboard' | 'uploading' | 'chat' | 'view-summary' | 'error';

export interface SummaryData {
  [key: string]: string;
}

export interface ChatMessage {
  sender: 'user' | 'bot';
  text: string;
}

export interface DocumentItem {
  id: string; // "01", "02", etc.
  nombreDocumento: string;
  storageId: string;
  // summary y resumen ya no son obligatorios aquí porque viven en otra colección, 
  // pero los mantenemos opcionales por compatibilidad con datos viejos si es necesario.
  summary?: string | SummaryData; 
  resumen?: string; 
  createdAt: number;
}

// Nueva interfaz para la colección 'resumenes'
// Estructura: uid, Id_documento, fileName, resumen
export interface ResumenDocument {
  uid: string;         // ID del usuario propietario
  Id_documento: string; // ID interno visual, ej: "01"
  fileName: string;    // Nombre del archivo
  resumen: string;     // Contenido del resumen
}

export interface UserDocument {
  documents: DocumentItem[];
}

export type FirebaseUser = User;
