import { mapWithConcurrency, retryTransient } from './retry.ts';

/** GEMINI_API_BASE permite apuntar a un simulador en las pruebas locales. */
const apiBase = (Deno.env.get('GEMINI_API_BASE') || 'https://generativelanguage.googleapis.com').replace(/\/+$/, '');
const geminiKey = Deno.env.get('GEMINI_API_KEY') || '';
export const embeddingModel = 'gemini-embedding-001';
export const chatModel = 'gemini-3.6-flash';

export class GeminiHttpError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export const requestGemini = async (path: string, body: unknown, label: string): Promise<any> =>
  retryTransient(async () => {
    const response = await fetch(`${apiBase}/v1beta/models/${path}?key=${geminiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const referenceId = crypto.randomUUID();
      console.error(`[Gemini] ${label} failed status=${response.status} reference=${referenceId}`);
      throw new GeminiHttpError(`${label} failed; reference=${referenceId}`, response.status);
    }
    return response.json();
  }, label);

export const generateEmbedding = async (text: string): Promise<number[]> => {
  const data = await requestGemini(
    `${embeddingModel}:embedContent`,
    { content: { parts: [{ text }] }, outputDimensionality: 768 },
    'Embedding request',
  );
  return data.embedding.values;
};

export const generateEmbeddingsBatch = async (texts: string[]): Promise<number[][]> => {
  try {
    const data = await requestGemini(
      `${embeddingModel}:batchEmbedContents`,
      { requests: texts.map((text) => ({
        model: `models/${embeddingModel}`,
        content: { parts: [{ text }] },
        outputDimensionality: 768,
      })) },
      'Batch embedding request',
    );
    return data.embeddings.map((item: { values: number[] }) => item.values);
  } catch (error) {
    console.warn('Batch embeddings unavailable; using limited parallel fallback', error);
    return mapWithConcurrency(texts, 5, generateEmbedding);
  }
};

export const generateContent = (systemPrompt: string, contents: unknown[], tools?: unknown[], label = 'Chat generation request') =>
  requestGemini(
    `${chatModel}:generateContent`,
    { systemInstruction: { parts: [{ text: systemPrompt }] }, contents, tools },
    label,
  );
