import {GoogleGenerativeAI} from "@google/generative-ai";
import {generateEmbedding} from "./geminiService";
import {searchSimilarDocuments} from "./supabaseService";
import {CHAT_NO_RESULTS_HTML, CHAT_SYSTEM_PROMPT} from "../utils/prompts";

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey || "");

const SEARCH_TOOL_NAME = "search_document_chunks";

const searchDocumentTool = {
  name: SEARCH_TOOL_NAME,
  description:
    "Searches only the active document chunks stored in the vector database. Always filter strictly by the active document name before returning evidence.",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description:
          "Natural-language search query to run against the active document.",
      },
      documentName: {
        type: "string",
        description:
          "Exact active document identifier stored in metadata Documento/fileName.",
      },
      limit: {
        type: "integer",
        minimum: 1,
        maximum: 8,
        description: "Maximum number of matching chunks to retrieve.",
      },
      retrievalMode: {
        type: "string",
        enum: ["specific", "broad"],
        description:
          "Use specific for exact facts and broad for general comparisons.",
      },
    },
    required: ["query", "documentName"],
  },
};

interface ChatHistoryItem {
  role: string;
  content: string;
}

interface DocumentSearchResult {
  content: string;
  metadata: {
    Titulo: string;
    Pagina: number;
    "Paragraph Index": number;
    Documento: string;
  };
}

interface ChatAgentParams {
  query: string;
  sessionId: string;
  fileName: string;
  history: ChatHistoryItem[];
}

const createModel = () => {
  return genAI.getGenerativeModel({
    model: "models/gemini-2.0-flash",
    generationConfig: {
      temperature: 0.1,
    },
    systemInstruction: CHAT_SYSTEM_PROMPT,
  } as any);
};

const buildHistory = (history: ChatHistoryItem[]) => {
  return history.map((message) => ({
    role: message.role === "user" ? "user" : "model",
    parts: [{text: message.content}],
  }));
};

const getFunctionCalls = (response: unknown): Array<{name: string; args: Record<string, unknown>}> => {
  const typedResponse = response as {
    functionCalls?: () => Array<{name: string; args?: Record<string, unknown>}>
    candidates?: Array<{
      content?: {
        parts?: Array<{functionCall?: {name: string; args?: Record<string, unknown>}}>
      }
    }>;
  };

  if (typeof typedResponse.functionCalls === "function") {
    return typedResponse.functionCalls().map((call) => ({
      name: call.name,
      args: call.args || {},
    }));
  }

  const parts = typedResponse.candidates?.[0]?.content?.parts || [];
  return parts
    .filter((part) => Boolean(part.functionCall))
    .map((part) => ({
      name: part.functionCall!.name,
      args: part.functionCall!.args || {},
    }));
};

const getResponseText = (response: unknown): string => {
  const typedResponse = response as {text?: () => string};
  if (typeof typedResponse.text === "function") {
    return typedResponse.text();
  }

  return "";
};

const normalizeHtmlResponse = (responseText: string): string => {
  const trimmed = responseText.trim();
  if (!trimmed) {
    return CHAT_NO_RESULTS_HTML;
  }

  if (trimmed.startsWith("<div")) {
    return trimmed;
  }

  const htmlStart = trimmed.indexOf("<div");
  const htmlEnd = trimmed.lastIndexOf("</div>");
  if (htmlStart >= 0 && htmlEnd > htmlStart) {
    return trimmed.slice(htmlStart, htmlEnd + 6);
  }

  return CHAT_NO_RESULTS_HTML;
};

const executeSearchTool = async (
  args: Record<string, unknown>,
  fallbackFileName: string
): Promise<{query: string; documentName: string; retrievalMode: string; results: DocumentSearchResult[]}> => {
  const query = typeof args.query === "string" && args.query.trim().length > 0 ? args.query : fallbackFileName;
  const documentName = typeof args.documentName === "string" && args.documentName.trim().length > 0
    ? args.documentName
    : fallbackFileName;
  const limitValue = Number(args.limit);
  const limit = Number.isFinite(limitValue) ? Math.min(Math.max(Math.trunc(limitValue), 1), 8) : 4;
  const retrievalMode = typeof args.retrievalMode === "string" ? args.retrievalMode : "specific";

  const queryEmbedding = await generateEmbedding(query);
  const results = await searchSimilarDocuments(queryEmbedding, documentName, limit);

  return {
    query,
    documentName,
    retrievalMode,
    results,
  };
};

export async function runChatAgent({
  query,
  sessionId,
  fileName,
  history,
}: ChatAgentParams): Promise<string> {
  const model = createModel();
  const chat = (model as any).startChat({
    history: buildHistory(history),
    tools: [{functionDeclarations: [searchDocumentTool]}],
  });

  const firstPrompt = [
    `Sesión activa: ${sessionId}`,
    `Documento activo: ${fileName}`,
    "Antes de contestar, consulta la herramienta search_document_chunks al menos una vez.",
    "Si la búsqueda devuelve cero fragmentos relevantes, responde con el bloque HTML de información no disponible.",
    `Pregunta del usuario: ${query}`,
  ].join("\n");

  let response = await chat.sendMessage(firstPrompt);

  for (let iteration = 0; iteration < 3; iteration += 1) {
    const functionCalls = getFunctionCalls(response.response);
    if (functionCalls.length === 0) {
      return normalizeHtmlResponse(getResponseText(response.response));
    }

    const functionResponses: Array<{functionResponse: {name: string; response: Record<string, unknown>}}> = [];

    for (const call of functionCalls) {
      if (call.name !== SEARCH_TOOL_NAME) {
        continue;
      }

      const searchResult = await executeSearchTool(call.args, fileName);

      if (searchResult.results.length === 0) {
        return CHAT_NO_RESULTS_HTML;
      }

      functionResponses.push({
        functionResponse: {
          name: SEARCH_TOOL_NAME,
          response: searchResult,
        },
      });
    }

    if (functionResponses.length === 0) {
      break;
    }

    response = await chat.sendMessage(functionResponses as any);
  }

  return normalizeHtmlResponse(getResponseText(response.response));
}