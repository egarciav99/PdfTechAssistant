import * as admin from "firebase-admin";
import {createHash} from "crypto";

const CACHE_COLLECTION = "embedding_cache";
const CACHE_TTL_DAYS = 30;

/**
 * Get cached embedding for text
 * Uses SHA-256 hash of text as cache key
 */
export async function getCachedEmbedding(
  text: string
): Promise<number[] | null> {
  try {
    const hash = createHash("sha256").update(text).digest("hex");
    const db = admin.firestore();
    const doc = await db.collection(CACHE_COLLECTION).doc(hash).get();

    if (!doc.exists) {
      return null;
    }

    const data = doc.data();
    if (!data) {
      return null;
    }

    // Check if cache entry is still valid
    const createdAt = data.createdAt?.toDate();
    if (createdAt) {
      const ageInDays = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
      if (ageInDays > CACHE_TTL_DAYS) {
        // Cache expired, delete it
        await db.collection(CACHE_COLLECTION).doc(hash).delete();
        return null;
      }
    }

    console.log(`Cache HIT for embedding (hash: ${hash.substring(0, 8)}...)`);
    return data.embedding as number[];
  } catch (error) {
    console.error("Error getting cached embedding:", error);
    return null;
  }
}

/**
 * Store embedding in cache
 */
export async function setCachedEmbedding(
  text: string,
  embedding: number[]
): Promise<void> {
  try {
    const hash = createHash("sha256").update(text).digest("hex");
    const db = admin.firestore();

    await db.collection(CACHE_COLLECTION).doc(hash).set({
      embedding: embedding,
      textLength: text.length,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`Cache MISS - Stored embedding (hash: ${hash.substring(0, 8)}...)`);
  } catch (error) {
    console.error("Error setting cached embedding:", error);
    // Don't throw - caching is optional
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{
    totalEntries: number;
    oldestEntry: Date | null;
    newestEntry: Date | null;
}> {
  try {
    const db = admin.firestore();
    const snapshot = await db.collection(CACHE_COLLECTION)
      .orderBy("createdAt", "desc")
      .limit(1000)
      .get();

    if (snapshot.empty) {
      return {
        totalEntries: 0,
        oldestEntry: null,
        newestEntry: null,
      };
    }

    const docs = snapshot.docs;
    const newest = docs[0].data().createdAt?.toDate() || null;
    const oldest = docs[docs.length - 1].data().createdAt?.toDate() || null;

    return {
      totalEntries: snapshot.size,
      oldestEntry: oldest,
      newestEntry: newest,
    };
  } catch (error) {
    console.error("Error getting cache stats:", error);
    return {
      totalEntries: 0,
      oldestEntry: null,
      newestEntry: null,
    };
  }
}

/**
 * Clear old cache entries
 */
export async function clearOldCacheEntries(daysOld = CACHE_TTL_DAYS): Promise<number> {
  try {
    const db = admin.firestore();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const snapshot = await db.collection(CACHE_COLLECTION)
      .where("createdAt", "<", cutoffDate)
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
    console.log(`Cleared ${snapshot.size} old cache entries`);
    return snapshot.size;
  } catch (error) {
    console.error("Error clearing old cache entries:", error);
    return 0;
  }
}
