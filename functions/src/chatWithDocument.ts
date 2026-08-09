import {onCall, HttpsError} from "firebase-functions/v2/https";
import {runChatAgent} from "./services/chatAgent";
import {
  getChatHistory,
  storeChatMessage,
} from "./services/supabaseService";

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
}, async (request: {auth?: {uid: string} | null; data: ChatRequest}) => {
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

    // 1. Get chat history
    const history = await getChatHistory(sessionId, 10);

    // 2. Run agent with function calling and strict document grounding
    const response = await runChatAgent({
      query,
      sessionId,
      fileName,
      history,
    });

    // 3. Store messages in chat memory
    await storeChatMessage(sessionId, "user", query);
    await storeChatMessage(sessionId, "assistant", response);

    // 4. Return response
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
