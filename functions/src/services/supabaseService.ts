import {createClient, SupabaseClient} from "@supabase/supabase-js";
import {getCachedSearch, setCachedSearch} from "./searchCache";

// Lazy initialization to avoid loading env vars at module load time
let supabaseClient: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    const supabaseUrl = process.env.SUPABASE_URL || "";
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || "";

    if (!supabaseUrl || !supabaseKey) {
      throw new Error(
        "SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in environment"
      );
    }

    supabaseClient = createClient(supabaseUrl, supabaseKey);
  }
  return supabaseClient;
}

interface DocumentMetadata {
  Titulo: string;
  Pagina: number;
  "Paragraph Index": number;
  Documento: string;
}

interface VectorDocument {
  content: string;
  metadata: DocumentMetadata;
  embedding: number[];
}

/**
 * Store document chunks with embeddings in Supabase vector store
 */
export async function storeDocumentChunks(
  chunks: VectorDocument[]
): Promise<void> {
  const supabase = getSupabaseClient();
  const {error} = await supabase
    .from("documents")
    .insert(chunks);

  if (error) {
    throw new Error(`Error storing documents: ${error.message}`);
  }
}

/**
 * Search for similar documents using vector similarity with caching
 */
export async function searchSimilarDocuments(
  queryEmbedding: number[],
  fileName: string,
  limit = 8
): Promise<Array<{ content: string; metadata: DocumentMetadata }>> {
  // 1. Check cache first
  const cached = await getCachedSearch<DocumentMetadata>(queryEmbedding, fileName);
  if (cached) {
    return cached;
  }

  // 2. Query Supabase
  const supabase = getSupabaseClient();
  const {data, error} = await supabase
    .rpc("match_documents", {
      query_embedding: queryEmbedding,
      match_threshold: 0.45,
      match_count: limit,
      filter: {Documento: fileName},
    });

  if (error) {
    throw new Error(`Error searching documents: ${error.message}`);
  }

  const results = data || [];

  // 3. Cache the results
  await setCachedSearch(queryEmbedding, fileName, results);

  return results;
}

/**
 * Check if document already exists in vector store
 */
export async function documentExists(fileName: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  const {data, error} = await supabase
    .from("documents")
    .select("id")
    .eq("metadata->>Documento", fileName)
    .limit(1);

  if (error) {
    console.error("Error checking document existence:", error);
    return false;
  }

  return (data?.length || 0) > 0;
}

/**
 * Delete all chunks for a specific document
 */
export async function deleteDocumentChunks(fileName: string): Promise<void> {
  const supabase = getSupabaseClient();
  const {error} = await supabase
    .from("documents")
    .delete()
    .eq("metadata->>Documento", fileName);

  if (error) {
    throw new Error(`Error deleting document chunks: ${error.message}`);
  }
}

/**
 * Store chat message in memory
 */
export async function storeChatMessage(
  sessionId: string,
  role: "user" | "assistant",
  content: string
): Promise<void> {
  const supabase = getSupabaseClient();
  const {error} = await supabase
    .from("chat_memory")
    .insert({
      session_id: sessionId,
      role: role,
      content: content,
      created_at: new Date().toISOString(),
    });

  if (error) {
    throw new Error(`Error storing chat message: ${error.message}`);
  }
}

/**
 * Retrieve chat history for a session
 */
export async function getChatHistory(
  sessionId: string,
  limit = 10
): Promise<Array<{ role: string; content: string }>> {
  const supabase = getSupabaseClient();
  const {data, error} = await supabase
    .from("chat_memory")
    .select("role, content")
    .eq("session_id", sessionId)
    .order("created_at", {ascending: true})
    .limit(limit);

  if (error) {
    throw new Error(`Error retrieving chat history: ${error.message}`);
  }

  return data || [];
}
