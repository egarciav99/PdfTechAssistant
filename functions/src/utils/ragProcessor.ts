/**
 * RAG (Retrieval Augmented Generation) text processing utilities
 * Replicates the logic from n8n workflow Code in JavaScript node
 */

export interface RAGSegment {
    documentSource: string;
    page_number: number;
    paragraph_index: number;
    section_title: string;
    text_segment: string;
    text_to_embed: string;
}

/**
 * Segment text into chunks with context for RAG
 */
export function segmentTextForRAG(
  fullText: string,
  fileName: string
): RAGSegment[] {
  // Configuration
  const minSegmentLength = 30;
  const segmentSeparator = "\n\n";

  // Split text
  const rawSegments = fullText.split(segmentSeparator);
  const ragSegments: RAGSegment[] = [];
  let segmentCounter = 1;

  // Track current section title
  let currentSectionTitle = "Introducción / General";

  for (const segment of rawSegments) {
    const trimmedSegment = segment.trim();

    // Filter noise (very short or empty segments)
    if (trimmedSegment.length < minSegmentLength) continue;

    // Detect section titles
    // Patterns like "1. Introduction", "4.1 Wiring", "3.2.1. Specifications"
    const sectionMatch = trimmedSegment.match(/^(\d+(\.\d+)*)\.\?\s+/);

    if (sectionMatch) {
      // Update section title memory
      currentSectionTitle = trimmedSegment.split("\n")[0].trim();
    }

    // Inject context for embedding
    const enrichedText = `[CONTEXTO: ${currentSectionTitle}]\nCONTENIDO: ${trimmedSegment}`;

    // Build final object
    ragSegments.push({
      documentSource: fileName,
      page_number: 0, // PDFs parsed to plain text often lose exact page numbers
      paragraph_index: segmentCounter,
      section_title: currentSectionTitle,
      text_segment: trimmedSegment, // Original text (for display)
      text_to_embed: enrichedText, // Enriched text (for Gemini to understand)
    });

    segmentCounter++;
  }

  return ragSegments;
}

/**
 * Split text into chunks with overlap for processing
 */
export function splitTextIntoChunks(
  text: string,
  numParts = 3,
  overlapChars = 1000
): Array<{ part_number: number; total_parts: number; text_chunk: string }> {
  const totalLength = text.length;
  const chunkSize = Math.ceil(totalLength / numParts);
  const chunks = [];

  for (let i = 0; i < numParts; i++) {
    // Start point
    const start = i * chunkSize;

    // End point
    let end: number;
    if (i === numParts - 1) {
      // Last chunk goes to the end
      end = totalLength;
    } else {
      // Add overlap
      end = start + chunkSize + overlapChars;
    }

    // Extract chunk
    const chunkContent = text.substring(start, end);

    chunks.push({
      part_number: i + 1,
      total_parts: numParts,
      text_chunk: chunkContent,
    });
  }

  return chunks;
}
