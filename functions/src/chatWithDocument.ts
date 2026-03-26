import {onCall, HttpsError} from "firebase-functions/v2/https";
import {generateEmbedding, generateChatResponse} from "./services/geminiService";
import {
  searchSimilarDocuments,
  getChatHistory,
  storeChatMessage,
} from "./services/supabaseService";
import {CHAT_SYSTEM_PROMPT} from "./utils/prompts";

interface ChatRequest {
  query: string;
  sessionId: string;
  fileName: string;
  docId: string;
}

/**
 * Callable Cloud Function for chat with RAG
 * Handles user queries securely and returns AI responses with document context
 */
export const chatWithDocument = onCall({
  timeoutSeconds: 60,
  memory: "512MiB",
  region: "us-central1",
  cors: true,
  // Removed minInstances to eliminate idle costs
  maxInstances: 100, // Scale up to 100 instances under load
  concurrency: 80, // Each instance handles 80 concurrent requests
}, async (request) => {
  // 1. Verify Authentication
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "Only authenticated users can access this service."
    );
  }
  const uid = request.auth.uid;

  try {
    const {query, sessionId, fileName} = request.data as ChatRequest;

    if (!query || !sessionId || !fileName) {
      throw new HttpsError(
        "invalid-argument",
        "Missing required fields: query, sessionId, fileName"
      );
    }

    // SECURITY: Verify the document belongs to the authenticated user
    if (!fileName.startsWith(uid + "_")) {
      throw new HttpsError(
        "permission-denied",
        "You do not have permission to access this document."
      );
    }

    console.log(`Chat request from user ${uid} for document ${fileName}`);

    // 1. Generate embedding for user query
    const queryEmbedding = await generateEmbedding(query);

    // 2. Search for similar documents in vector store
    const similarDocs = await searchSimilarDocuments(
      queryEmbedding,
      fileName,
      5
    );

    // 3. Build context from similar documents
    const context = similarDocs
      .map((doc, index) => {
        return `[Fragmento ${index + 1} - ${doc.metadata.Titulo}]\n${doc.content}`;
      })
      .join("\n\n---\n\n");

    // 4. Get chat history
    const history = await getChatHistory(sessionId, 10);
    const historyContext = history
      .map((msg) => `${msg.role === "user" ? "Usuario" : "Asistente"}: ${msg.content}`)
      .join("\n");

    // 5. Build full context
    const fullContext = `HISTORIAL DE CONVERSACIÓN:\n${historyContext}\n\n---\n\nDOCUMENTACIÓN RELEVANTE:\n${context}`;

    // 6. Generate response with Gemini
    const response = await generateChatResponse(
      query,
      fullContext,
      CHAT_SYSTEM_PROMPT
    );

    // 7. Store messages in chat memory
    await storeChatMessage(sessionId, "user", query);
    await storeChatMessage(sessionId, "assistant", response);

    // 8. Return response
    return {
      output: response,
      sessionId: sessionId,
    };
  } catch (error) {
    console.error("Error in chat function:", error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError(
      "internal",
      "Internal server error",
      String(error)
    );
  }
});
