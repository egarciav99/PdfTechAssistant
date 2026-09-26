import { useCallback, useEffect, useMemo, useState } from 'react';
import { loadAccess, type Access, type Org, type Role } from '../services/orgs';

const ORG_KEY = 'pdftechassistant.currentOrg';

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Sin almacenamiento: solo se pierde la preferencia.
  }
}

export interface UseOrgsReturn {
  access: Access | null;
  /** Solo la primera carga: los refrescos no desmontan la pantalla. */
  isLoading: boolean;
  error: string | null;
  currentOrg: Org | null;
  /** Rol efectivo en la empresa actual (el superadmin actúa como admin). */
  role: Role | null;
  isSuperadmin: boolean;
  selectOrg: (orgId: string) => void;
  refresh: (preferOrgId?: string) => Promise<void>;
}

export const useOrgs = (userId: string | null): UseOrgsReturn => {
  const [access, setAccess] = useState<Access | null>(null);
  const [orgId, setOrgId] = useState<string | null>(() => readStorage(ORG_KEY));
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (preferOrgId?: string) => {
    if (!userId) return;
    setError(null);
    try {
      const next = await loadAccess(userId);
      setAccess(next);
      setOrgId((prev) => {
        const wanted = preferOrgId || prev;
        const chosen = next.orgs.find((o) => o.id === wanted)?.id
          ?? next.orgs.find((o) => next.memberships.some((m) => m.org_id === o.id))?.id
          ?? next.orgs[0]?.id
          ?? null;
        if (chosen) writeStorage(ORG_KEY, chosen);
        return chosen;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [userId]);

  useEffect(() => {
    if (userId) refresh();
    else setAccess(null);
  }, [userId, refresh]);

  const selectOrg = useCallback((id: string) => {
    writeStorage(ORG_KEY, id);
    setOrgId(id);
  }, []);

  const currentOrg = useMemo(() => access?.orgs.find((o) => o.id === orgId) ?? null, [access, orgId]);
  const role: Role | null = useMemo(() => {
    if (!access || !currentOrg) return null;
    const own = access.memberships.find((m) => m.org_id === currentOrg.id)?.role ?? null;
    return access.isSuperadmin ? 'admin' : own;
  }, [access, currentOrg]);

  return {
    access,
    isLoading: Boolean(userId) && !access && !error,
    error,
    currentOrg,
    role,
    isSuperadmin: Boolean(access?.isSuperadmin),
    selectOrg,
    refresh,
  };
};

export default useOrgs;
