import { useState, useEffect, useCallback } from 'react';
import { 
  auth, 
  onAuthStateChanged, 
  signOut as firebaseSignOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  createUserDocument
} from '../services/firebase';
import type { FirebaseUser } from '../types';

interface UseAuthReturn {
  currentUser: FirebaseUser | null;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

export const useAuth = (): UseAuthReturn => {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        await createUserDocument(user.uid);
      }
      setIsLoading(false);
    });
    
    return () => unsubscribe();
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const login = useCallback(async (email: string, password: string): Promise<void> => {
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      const message = err.message || 'Failed to sign in. Please check your credentials.';
      setError(message);
      throw new Error(message);
    }
  }, []);

  const register = useCallback(async (email: string, password: string): Promise<void> => {
    setError(null);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await createUserDocument(userCredential.user.uid);
    } catch (err: any) {
      const message = err.message || 'Failed to create account. The email might already be in use.';
      setError(message);
      throw new Error(message);
    }
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    try {
      await firebaseSignOut(auth);
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
