import {PDFExtract, PDFExtractOptions, PDFExtractText} from "pdf.js-extract";

const pdfExtract = new PDFExtract();

/**
 * Extract text from PDF buffer using pdf.js-extract
 * This library is similar to PyMuPDF and preserves text layout better than pdf-parse
 */
export async function extractTextFromPDF(
  pdfBuffer: Buffer
): Promise<string> {
  try {
    const options: PDFExtractOptions = {};
    const data = await pdfExtract.extractBuffer(pdfBuffer, options);

    // Concatenate text from all pages, similar to PyMuPDF's page.get_text()
    let textOutput = "";

    for (const page of data.pages) {
      // Sort content by Y position (top to bottom) then X position (left to right)
      const sortedContent = page.content.sort((a: PDFExtractText, b: PDFExtractText) => {
        if (Math.abs(a.y - b.y) < 2) { // Same line (within 2px tolerance)
          return a.x - b.x; // Sort by X (left to right)
        }
        return a.y - b.y; // Sort by Y (top to bottom)
      });

      // Extract text maintaining layout
      for (const item of sortedContent) {
        textOutput += item.str + " ";
      }
      textOutput += "\n"; // New line after each page
    }

    return textOutput.trim();
  } catch (error) {
    throw new Error(`Failed to extract text from PDF: ${error}`);
  }
}

/**
 * Get PDF metadata including total pages
 */
export async function getPDFMetadata(pdfBuffer: Buffer): Promise<{
    pages: number;
    filename?: string;
}> {
  try {
    const options: PDFExtractOptions = {};
    const data = await pdfExtract.extractBuffer(pdfBuffer, options);

    return {
      pages: data.pages.length,
      filename: data.filename,
    };
  } catch (error) {
    throw new Error(`Failed to get PDF metadata: ${error}`);
  }
}
