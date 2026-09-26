import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import type { SupabaseUser } from '../types';

// Los enlaces de invitación y recuperación llegan con #type=invite|recovery;
// se lee antes de que supabase-js limpie la URL.
const LANDED_TO_SET_PASSWORD = typeof window !== 'undefined' && /type=(invite|recovery)/.test(window.location.hash);

interface UseAuthReturn {
  currentUser: SupabaseUser | null;
  isLoading: boolean;
  /** Tras abrir una invitación o un enlace de recuperación hay que crear contraseña. */
  mustSetPassword: boolean;
  passwordSet: () => void;
  logout: () => Promise<void>;
}

export const useAuth = (): UseAuthReturn => {
  const [currentUser, setCurrentUser] = useState<SupabaseUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mustSetPassword, setMustSetPassword] = useState(LANDED_TO_SET_PASSWORD);

  useEffect(() => {
    const sb = supabase();
    sb.auth.getSession().then(({ data }) => {
      setCurrentUser(data.session?.user ?? null);
      setIsLoading(false);
    });
    const { data } = sb.auth.onAuthStateChange((event, session) => {
      setCurrentUser(session?.user ?? null);
      setIsLoading(false);
      if (event === 'PASSWORD_RECOVERY') setMustSetPassword(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const passwordSet = useCallback(() => {
    setMustSetPassword(false);
    if (window.location.hash) window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    await supabase().auth.signOut();
  }, []);

  return { currentUser, isLoading, mustSetPassword, passwordSet, logout };
};

export default useAuth;
