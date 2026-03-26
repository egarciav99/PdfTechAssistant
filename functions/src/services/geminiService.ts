import {GoogleGenerativeAI} from "@google/generative-ai";
import pLimit from "p-limit";
import pRetry from "p-retry";
import {
  getCachedEmbedding,
  setCachedEmbedding,
} from "./embeddingCache";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn("WARNING: GEMINI_API_KEY is not defined in the environment.");
}
const genAI = new GoogleGenerativeAI(apiKey || "");

// Rate limiter: 10 concurrent requests max
const limiter = pLimit(10);

// Metrics tracking
let cacheHits = 0;
let cacheMisses = 0;
let apiCalls = 0;

/**
 * Generate embeddings for text using Google Gemini with caching and rate limiting
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  // 1. Check cache first
  const cached = await getCachedEmbedding(text);
  if (cached) {
    cacheHits++;
    return cached;
  }

  cacheMisses++;

  // 2. Rate-limited API call with retry logic
  return limiter(() =>
    pRetry(
      async () => {
        apiCalls++;
        const model = genAI.getGenerativeModel({model: "models/gemini-embedding-001"});
        // The outputDimensionality property exists in the API but is missing from
        // the current version of the @google/generative-ai types
        interface EmbedContentRequestWithDims {
          content: { role: string, parts: { text: string }[] };
          outputDimensionality?: number;
        }
        
        const requestArgs: EmbedContentRequestWithDims = {
          content: {role: "user", parts: [{text: text}]},
          outputDimensionality: 768,
        };
        
        const result = await (model as any).embedContent(requestArgs);

        const embedding = result.embedding.values;

        // 3. Cache the result
        await setCachedEmbedding(text, embedding);

        return embedding;
      },
      {
        retries: 3,
        minTimeout: 1000,
        maxTimeout: 5000,
        factor: 2,
        onFailedAttempt: (error) => {
          console.warn(
            `Embedding attempt ${error.attemptNumber} failed. ` +
            `${error.retriesLeft} retries left.`
          );
        },
      }
    )
  );
}

/**
 * Generate chat response using Gemini with context
 */
export async function generateChatResponse(
  query: string,
  context: string,
  systemPrompt: string
): Promise<string> {
  return limiter(() =>
    pRetry(
      async () => {
        apiCalls++;
        const model = genAI.getGenerativeModel({
          model: "models/gemini-2.0-flash",
        });

        const prompt = `${systemPrompt}\n\nCONTEXTO:\n${context}\n\nPREGUNTA DEL USUARIO:\n${query}`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
      },
      {
        retries: 2,
        minTimeout: 1000,
        maxTimeout: 3000,
        onFailedAttempt: (error) => {
          console.warn(
            `Chat generation attempt ${error.attemptNumber} failed. ` +
            `${error.retriesLeft} retries left.`
          );
        },
      }
    )
  );
}

/**
 * Generate summary from document chunks
 */
export async function generateSummary(
  textChunks: string[],
  systemPrompt: string
): Promise<string> {
  const model = genAI.getGenerativeModel({
    model: "models/gemini-2.0-flash",
  });

  // Process each chunk with rate limiting
  const partialSummaries: string[] = [];

  for (const chunk of textChunks) {
    const summary = await limiter(() =>
      pRetry(
        async () => {
          apiCalls++;
          const prompt = `Dame el resumen técnico del documento:\n${chunk}`;
          const result = await model.generateContent([
            {text: systemPrompt},
            {text: prompt},
          ]);
          const response = await result.response;
          return response.text();
        },
        {
          retries: 2,
          minTimeout: 1000,
          maxTimeout: 3000,
        }
      )
    );
    partialSummaries.push(summary);
  }

  // Combine summaries
  const combinedText = partialSummaries.join("\n\n");

  // Generate final summary with rate limiting
  const finalSummary = await limiter(() =>
    pRetry(
      async () => {
        apiCalls++;
        const finalPrompt = `Dame el resumen técnico del documento:\n${combinedText}`;
        const finalResult = await model.generateContent([
          {text: systemPrompt},
          {text: finalPrompt},
        ]);
        const finalResponse = await finalResult.response;
        return finalResponse.text();
      },
      {
        retries: 2,
        minTimeout: 1000,
        maxTimeout: 3000,
      }
    )
  );

  return finalSummary;
}



