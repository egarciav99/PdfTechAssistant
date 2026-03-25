/**
 * Utility function to access environment variables safely.
 * Since this is a Vite/Modern setup, we use import.meta.env.
 * Throws an error if the variable is missing to fail fast and securely.
 */
const getEnv = (key: string): string => {
  // Cast import.meta to any to fix "Property 'env' does not exist on type 'ImportMeta'" error
  const value = (import.meta as any).env[key];
  
  if (value === undefined || value === '') {
    // In production, you might want to log this to an error reporting service
    throw new Error(`Missing environment variable: ${key}. Please check your .env file.`);
  }
  
  return value;
};

// Firebase Configuration
// Values are retrieved from environment variables prefixed with VITE_
export const FIREBASE_CONFIG = {
  apiKey: getEnv("VITE_FIREBASE_API_KEY"),
  authDomain: getEnv("VITE_FIREBASE_AUTH_DOMAIN"),
  projectId: getEnv("VITE_FIREBASE_PROJECT_ID"),
  storageBucket: getEnv("VITE_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: getEnv("VITE_FIREBASE_MESSAGING_SENDER_ID"),
  appId: getEnv("VITE_FIREBASE_APP_ID"),
  measurementId: getEnv("VITE_FIREBASE_MEASUREMENT_ID")
};

// Firebase Functions Configuration
export const FIREBASE_FUNCTION_REGION = "us-central1";

// Chat function URL (deployed Cloud Run URL)
export const CHAT_FUNCTION_URL = "https://chatwithdocument-cqaxuwwhba-uc.a.run.app";