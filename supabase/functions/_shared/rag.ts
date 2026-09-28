import { generateContent, generateEmbedding } from './gemini.ts';
import { NO_RESULTS_HTML } from './prompts.ts';
import type { Lang } from './common.ts';

/** Fragmento recuperado de la búsqueda vectorial. */
export interface ChunkMatch {
  content: string;
  metadata: unknown;
  similarity: number;
}

/** Busca fragmentos del documento activo. Cada llamada decide cómo (RLS del usuario o demo). */
export type SearchChunks = (embedding: number[], limit: number) => Promise<ChunkMatch[]>;

const tool = {
  functionDeclarations: [{
    name: 'search_document_chunks',
    description: 'Busca evidencia únicamente dentro del documento activo.',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: { type: 'STRING', description: 'Consulta específica o amplia para recuperar evidencia.' },
        documentId: { type: 'STRING', description: 'UUID exacto del documento activo.' },
        limit: { type: 'INTEGER', description: 'Cantidad de fragmentos, entre 1 y 8.' },
      },
      required: ['query', 'documentId'],
    },
  }],
};

/**
 * Responde una consulta con el agente RAG: Gemini llama a la herramienta de búsqueda,
 * que siempre busca en el documento activo (se ignora el documentId que proponga el modelo).
 * Devuelve HTML; si no hay evidencia, la respuesta fija de "información no disponible".
 */
export async function answerFromDocument(options: {
  systemPrompt: string;
  history: { role: 'user' | 'assistant'; content: string }[];
  documentId: string;
  query: string;
  lang: Lang;
  search: SearchChunks;
}): Promise<string> {
  const { systemPrompt, history, documentId, query, lang, search } = options;
  const contents: any[] = history.map((message) => ({ role: message.role === 'assistant' ? 'model' : 'user', parts: [{ text: message.content }] }));
  contents.push({ role: 'user', parts: [{ text: `Documento activo: ${documentId}\nConsulta actual: ${query}\nResponde solo a esta consulta actual. Los mensajes anteriores son contexto: no vuelvas a responderlos ni los mezcles con esta respuesta. Debes usar la herramienta antes de responder.` }] });

  let result = await generateContent(systemPrompt, contents, [tool]);
  let foundResultsInRequest = false;
  for (let attempt = 0; attempt < 3; attempt++) {
    const parts = result.candidates?.[0]?.content?.parts || [];
    const calls = parts.filter((part: any) => part.functionCall);
    if (!calls.length) break;
    const functionParts = [];
    let foundResultsInTurn = false;
    for (const part of calls) {
      const args = part.functionCall.args || {};
      const searchText = typeof args.query === 'string' && args.query.trim() ? args.query : query;
      const vector = await generateEmbedding(searchText);
      const limit = Math.min(Math.max(Number(args.limit) || 4, 1), 8);
      const matches = await search(vector, limit);
      if (matches.length) {
        foundResultsInTurn = true;
        foundResultsInRequest = true;
      }
      const dataResults = matches.map((match) => ({
        ...match,
        content: `<<<BEGIN RETRIEVED DATA>>>\n${match.content}\n<<<END RETRIEVED DATA>>>`,
      }));
      functionParts.push({ functionResponse: { name: 'search_document_chunks', response: { documentId, results: dataResults } } });
    }
    contents.push({ role: 'model', parts });
    contents.push({ role: 'user', parts: functionParts });
    result = await generateContent(systemPrompt, contents, [tool]);

    if (!foundResultsInTurn && !foundResultsInRequest) return NO_RESULTS_HTML[lang];
  }

  const output = result.candidates?.[0]?.content?.parts?.map((part: any) => part.text || '').join('').trim() || NO_RESULTS_HTML[lang];
  return output.startsWith('<div') ? output : NO_RESULTS_HTML[lang];
}
