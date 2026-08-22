import { useState, useEffect, useCallback } from 'react';
import { 
  onAuthStateChanged, 
  signOut,
  createUserWithEmailAndPassword,
  createUserDocument
} from '../services/supabase';
import { signInWithEmailAndPassword } from '../services/supabase';
import type { SupabaseUser } from '../types';

interface UseAuthReturn {
  currentUser: SupabaseUser | null;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

export const useAuth = (): UseAuthReturn => {
  const [currentUser, setCurrentUser] = useState<SupabaseUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Listen for auth state changes
  useEffect(() => {
    const { data } = onAuthStateChanged(async (_event, session) => {
      const user = session?.user || null;
      setCurrentUser(user);
      if (user) {
        try {
          await createUserDocument(user);
        } catch (error) {
          console.error('Failed to initialize user profile', error);
        }
      }
      setIsLoading(false);
    });
    
    return () => data.subscription.unsubscribe();
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const login = useCallback(async (email: string, password: string): Promise<void> => {
    setError(null);
    try {
      const { error } = await signInWithEmailAndPassword(email, password);
      if (error) throw error;
    } catch (err: any) {
      const message = err.message || 'Failed to sign in. Please check your credentials.';
      setError(message);
      throw new Error(message);
    }
  }, []);

  const register = useCallback(async (email: string, password: string): Promise<void> => {
    setError(null);
    try {
      const { data, error } = await createUserWithEmailAndPassword(email, password);
      if (error) throw error;
      if (data.user) await createUserDocument(data.user);
    } catch (err: any) {
      const message = err.message || 'Failed to create account. The email might already be in use.';
      setError(message);
      throw new Error(message);
    }
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    try {
      const { error } = await signOut();
      if (error) throw error;
    } catch (err: any) {
      const message = err.message || 'Failed to sign out.';
      setError(message);
      throw new Error(message);
    }
  }, []);

  return {
    currentUser,
    isLoading,
    error,
    login,
    register,
    logout,
    clearError
  };
};

export default useAuth;
