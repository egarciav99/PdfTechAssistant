import * as functions from "firebase-functions/v2";
import * as admin from "firebase-admin";
import {extractTextFromPDF} from "./utils/pdfExtractor";
import {cleanAndAnonymizeText} from "./utils/textCleaner";
import {segmentTextForRAG, splitTextIntoChunks} from "./utils/ragProcessor";
import {generateEmbedding, generateSummary} from "./services/geminiService";
import {
  storeDocumentChunks,
  documentExists,
  deleteDocumentChunks,
} from "./services/supabaseService";
import {SUMMARY_SYSTEM_PROMPT} from "./utils/prompts";

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const storage = admin.storage();

/**
 * Cloud Function triggered when a file is uploaded to Firebase Storage
 * Processes PDF documents: extracts text, generates embeddings, creates summary
 */
export const processDocument = functions.storage.onObjectFinalized({
  timeoutSeconds: 540,
  memory: "2GiB",
  region: "us-central1",
}, async (event) => {
  const filePath = event.data.name;
  const contentType = event.data.contentType;

  // Only process PDF files
  if (!contentType || !contentType.includes("pdf")) {
    console.log("Not a PDF file, skipping");
    return null;
  }

  // Extract metadata from filename (format: UID_filename.pdf)
  if (!filePath) return null;
  const fileName = filePath.split("/").pop() || "";
  const uid = fileName.split("_")[0];

  console.log(`Processing document: ${fileName} for user: ${uid}`);

  try {
    // 1. Check if document already exists in vector store
    const exists = await documentExists(fileName);
    if (exists) {
      console.log(`Document ${fileName} already processed, deleting old data`);
      await deleteDocumentChunks(fileName);
    }

    // 2. Download PDF from Storage
    const bucket = storage.bucket(event.data.bucket);
    const file = bucket.file(filePath);
    const [fileBuffer] = await file.download();

    // 3. Extract text from PDF
    console.log("Extracting text from PDF...");
    const rawText = await extractTextFromPDF(fileBuffer);

    if (!rawText || rawText.length === 0) {
      throw new Error("No text extracted from PDF");
    }

    // 4. Clean and anonymize text
    console.log("Cleaning and anonymizing text...");
    const cleanedText = cleanAndAnonymizeText(rawText);

    // 5. Segment text for RAG
    console.log("Segmenting text for RAG...");
    const ragSegments = segmentTextForRAG(cleanedText, fileName);

    // 6. Generate embeddings and store in batches of 5
    console.log(`Generating embeddings for ${ragSegments.length} segments...`);
    const batchSize = 5;
    for (let i = 0; i < ragSegments.length; i += batchSize) {
      const batch = ragSegments.slice(i, i + batchSize);

      const documentsWithEmbeddings = await Promise.all(
        batch.map(async (segment) => {
          const embedding = await generateEmbedding(segment.text_to_embed);
          return {
            content: segment.text_segment,
            metadata: {
              "Titulo": segment.section_title,
              "Pagina": segment.page_number,
              "Paragraph Index": segment.paragraph_index,
              "Documento": segment.documentSource,
            },
            embedding: embedding,
          };
        })
      );

      // Store batch in Supabase
      await storeDocumentChunks(documentsWithEmbeddings);
      console.log(`Stored batch ${Math.floor(i / batchSize) + 1}`);
    }

    // 7. Generate summary
    console.log("Generating summary...");
    const textChunks = splitTextIntoChunks(cleanedText, 3, 1000);
    const chunkTexts = textChunks.map((chunk) => chunk.text_chunk);
    const summary = await generateSummary(chunkTexts, SUMMARY_SYSTEM_PROMPT);

    // 8. Save summary to Firestore
    console.log("Saving summary to Firestore...");
    await db.collection("resumenes").doc(fileName).set({
      uid: uid,
      fileName: fileName,
      resumen: summary,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`Document ${fileName} processed successfully`);
    return {success: true, fileName};
  } catch (error) {
    console.error(`Error processing document ${fileName}:`, error);
    // Store error in Firestore for debugging
    await db.collection("processing_errors").add({
      fileName: fileName,
      uid: uid,
      error: String(error),
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
    throw error;
  }
});
