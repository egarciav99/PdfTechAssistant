import * as admin from "firebase-admin";
import {createHash} from "crypto";

const CACHE_COLLECTION = "search_cache";
const CACHE_TTL_SECONDS = 3600; // 1 hour

interface CachedSearchResult {
    content: string;
    metadata: any;
    similarity?: number;
}

/**
 * Generate cache key from query embedding and fileName
 */
function generateCacheKey(queryEmbedding: number[], fileName: string): string {
  // Use first 10 values of embedding + fileName for cache key
  const embeddingPrefix = queryEmbedding.slice(0, 10).join(",");
  const combined = `${fileName}:${embeddingPrefix}`;
  return createHash("sha256").update(combined).digest("hex");
}

/**
 * Get cached search results
 */
export async function getCachedSearch(
  queryEmbedding: number[],
  fileName: string
): Promise<CachedSearchResult[] | null> {
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
    return data.results as CachedSearchResult[];
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

/**
 * Clear all search cache entries for a specific document
 */
export async function clearSearchCacheForDocument(fileName: string): Promise<number> {
  try {
    const db = admin.firestore();
    const snapshot = await db.collection(CACHE_COLLECTION)
      .where("fileName", "==", fileName)
      .limit(100)
      .get();

    if (snapshot.empty) {
      return 0;
    }

    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    console.log(`Cleared ${snapshot.size} search cache entries for ${fileName}`);
    return snapshot.size;
  } catch (error) {
    console.error("Error clearing search cache:", error);
    return 0;
  }
}

/**
 * Clear old search cache entries
 */
export async function clearOldSearchCache(): Promise<number> {
  try {
    const db = admin.firestore();
    const cutoffDate = new Date();
    cutoffDate.setSeconds(cutoffDate.getSeconds() - CACHE_TTL_SECONDS);

    const snapshot = await db.collection(CACHE_COLLECTION)
      .where("timestamp", "<", cutoffDate)
      .limit(500)
      .get();

    if (snapshot.empty) {
      return 0;
    }

    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    console.log(`Cleared ${snapshot.size} old search cache entries`);
    return snapshot.size;
  } catch (error) {
    console.error("Error clearing old search cache:", error);
    return 0;
  }
}
