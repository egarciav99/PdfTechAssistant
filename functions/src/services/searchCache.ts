import * as admin from "firebase-admin";
import {createHash} from "crypto";

const CACHE_COLLECTION = "search_cache";
const CACHE_TTL_SECONDS = 3600; // 1 hour

export interface CachedSearchResult<T = Record<string, unknown>> {
    content: string;
    metadata: T;
    similarity?: number;
}

/**
 * Generate cache key from query embedding and fileName
 */
function generateCacheKey(queryEmbedding: number[], fileName: string): string {
  // Use first 50 values of embedding + fileName for cache key to prevent collision
  const embeddingPrefix = queryEmbedding.slice(0, 50).join(",");
  const combined = `${fileName}:${embeddingPrefix}`;
  return createHash("sha256").update(combined).digest("hex");
}

/**
 * Get cached search results
 */
export async function getCachedSearch<T = Record<string, unknown>>(
  queryEmbedding: number[],
  fileName: string
): Promise<CachedSearchResult<T>[] | null> {
  try {
    const cacheKey = generateCacheKey(queryEmbedding, fileName);
    const db = admin.firestore();
    const doc = await db.collection(CACHE_COLLECTION).doc(cacheKey).get();

    if (!doc.exists) {
      return null;
    }

    const data = doc.data();
    if (!data) {
      return null;
    }

    // Check if cache is still valid
    const timestamp = data.timestamp?.toDate();
    if (timestamp) {
      const ageInSeconds = (Date.now() - timestamp.getTime()) / 1000;
      if (ageInSeconds > CACHE_TTL_SECONDS) {
        // Cache expired
        await db.collection(CACHE_COLLECTION).doc(cacheKey).delete();
        return null;
      }
    }

    console.log(`Search cache HIT for ${fileName} (key: ${cacheKey.substring(0, 8)}...)`);
    return data.results as CachedSearchResult<T>[];
  } catch (error) {
    console.error("Error getting cached search:", error);
    return null;
  }
}

/**
 * Store search results in cache
 */
export async function setCachedSearch(
  queryEmbedding: number[],
  fileName: string,
  results: CachedSearchResult[]
): Promise<void> {
  try {
    const cacheKey = generateCacheKey(queryEmbedding, fileName);
    const db = admin.firestore();

    await db.collection(CACHE_COLLECTION).doc(cacheKey).set({
      results: results,
      fileName: fileName,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`Search cache MISS - Stored results for ${fileName} (key: ${cacheKey.substring(0, 8)}...)`);
  } catch (error) {
    console.error("Error setting cached search:", error);
    // Don't throw - caching is optional
  }
}


