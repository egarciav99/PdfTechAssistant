/**
 * Configuración en tiempo de ejecución. Se lee de `config.json`, junto al index.html,
 * para que cada instalación la cambie sin recompilar (ver docs/ENTREGA.md).
 * Lo que falte o venga vacío se completa con las variables VITE_* del build.
 */
export interface AppConfig {
  /** Nombre que se muestra en la pantalla de acceso (instalación en una sola empresa). */
  companyName: string;
  /** Logo de la pantalla de acceso. Dentro de la app se usa el logo de cada empresa. */
  logoUrl: string;
  /** Idioma inicial si el navegador no ha elegido otro: 'es' o 'en'. */
  defaultLanguage: 'es' | 'en';
  supabase: { url: string; anonKey: string };
}

const env = (import.meta as unknown as { env: Record<string, string | undefined> }).env || {};

const fromEnv: AppConfig = {
  companyName: env.VITE_COMPANY_NAME || '',
  logoUrl: env.VITE_LOGO_URL || '',
  defaultLanguage: env.VITE_DEFAULT_LANGUAGE === 'en' ? 'en' : 'es',
  supabase: {
    url: env.VITE_SUPABASE_URL || '',
    anonKey: env.VITE_SUPABASE_ANON_KEY || '',
  },
};

let current: AppConfig = fromEnv;

export function getConfig(): AppConfig {
  return current;
}

export async function loadConfig(): Promise<AppConfig> {
  try {
    const res = await fetch(`${env.BASE_URL || '/'}config.json`, { cache: 'no-store' });
    if (res.ok) {
      const file = (await res.json()) as Partial<AppConfig>;
      current = {
        companyName: file.companyName || fromEnv.companyName,
        logoUrl: file.logoUrl || fromEnv.logoUrl,
        defaultLanguage: file.defaultLanguage === 'en' || file.defaultLanguage === 'es' ? file.defaultLanguage : fromEnv.defaultLanguage,
        supabase: {
          url: file.supabase?.url || fromEnv.supabase.url,
          anonKey: file.supabase?.anonKey || fromEnv.supabase.anonKey,
        },
      };
    }
  } catch {
    // Sin config.json (p. ej. en desarrollo): se usan las variables de entorno.
  }
  return current;
}

/** Sin Supabase no hay app: no existe modo demo. */
export function isConfigured(): boolean {
  const { url, anonKey } = current.supabase;
  return Boolean(url && anonKey);
}
