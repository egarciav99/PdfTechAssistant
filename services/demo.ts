import { supabase, functionErrorBody } from './supabase';
import { currentLanguage } from '../i18n';

/** Estado de la demo pública: documento de ejemplo y preguntas que le quedan al visitante. */
export interface DemoInfo {
  available: boolean;
  document?: { name: string; title: string; summary: string };
  /** Preguntas sugeridas para empezar, en el idioma de la interfaz. */
  suggestions?: string[];
  questionsLeft?: number;
  limit?: number;
}

/** Error de la demo con su código: 'limit' (sin preguntas hoy), 'busy' (tope diario total), 'too_long'. */
export class DemoError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

async function callDemo<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase().functions.invoke('demo-chat', { body: { ...body, lang: currentLanguage() } });
  if (error) {
    const payload = await functionErrorBody(error);
    throw new DemoError(payload?.code || 'error', payload?.error || error.message);
  }
  return data as T;
}

export const getDemoInfo = () => callDemo<DemoInfo>({ action: 'info' });

export const askDemo = (query: string) => callDemo<{ output: string; questionsLeft: number }>({ action: 'ask', query });
