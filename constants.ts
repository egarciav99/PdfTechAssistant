
// IMPORTANT: Replace with your actual Firebase project configuration.
// This is example configuration and will not work.
export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDcUKnTuscsWqwqceXBNI2Rx8ZXg2Lh8Ug",
  authDomain: "pdf-extract-41d23.firebaseapp.com",
  projectId: "pdf-extract-41d23",
  storageBucket: "pdf-extract-41d23.firebasestorage.app",
  messagingSenderId: "750080586574",
  appId: "1:750080586574:web:61b95e7c0c9161a4a2641f",
  measurementId: "G-B013WTYD95"
};

// Webhook for the flow that uploads, sanitizes, extracts, and returns a summary.
export const N8N_INGESTION_URL = "https://egarciav.app.n8n.cloud/webhook/6491c2e2-939c-4f09-9bd3-36d941b42f59";

// Webhook for the chat flow with an AI agent.
export const N8N_CHAT_URL = "https://egarciav.app.n8n.cloud/webhook/002efa79-8bd6-4e9c-bdf0-0c9667a8f55d";
