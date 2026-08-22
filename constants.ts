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

export const SUPABASE_CONFIG = {
  url: getEnv("VITE_SUPABASE_URL"),
  anonKey: getEnv("VITE_SUPABASE_ANON_KEY"),
};