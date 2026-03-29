/**
 * Text cleaning and anonymization utilities
 * Replicates the logic from n8n workflow Code in JavaScript1 node
 */

/**
 * Clean and anonymize sensitive data from text
 */
export function cleanAndAnonymizeText(text: string): string {
  let cleanedText = text;

  // Remove excess whitespace and multiple line breaks
  cleanedText = cleanedText.replace(/\n\s*\n/g, "\n\n");

  // Remove index lines (dots followed by numbers)
  // Example: "Introduction .................... 5"
  cleanedText = cleanedText.replace(/^(.*?)[\s.]{5,}\d+$/gm, "[LINEA_INDICE_ELIMINADA]");

  // Remove isolated page numbers
  cleanedText = cleanedText.replace(/^\d+$/gm, "");

  // --- ANONYMIZATION PATTERNS ---

  // 1. Emails
  cleanedText = cleanedText.replace(
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    "[EMAIL_OCULTO]"
  );

  // 2. Phone numbers
  cleanedText = cleanedText.replace(
    /(\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/g,
    "[TEL_OCULTO]"
  );

  // 3. Monetary amounts
  cleanedText = cleanedText.replace(
    /\$?\d{1,3}(?:,\d{3})*(?:\.\d+)?\s?(?:USD|MXN|DLLS|dólares|pesos)/gi,
    "[MONTO_OCULTO]"
  );

  // 4. Addresses
  cleanedText = cleanedText.replace(
    /(Av\.|Calle|Blvd|Col\.|Residencial|C\.P\.)\s?[A-Z\d].*?(\n|,|$)/gi,
    "[DIRECCION_OCULTA] "
  );

  // 5. RFC (Mexican tax ID)
  cleanedText = cleanedText.replace(
    /[A-Z&]{3,4}\d{6}[A-Z0-9]{3}/g,
    "[RFC_OCULTO]"
  );

  // 6. Proper names (aggressive)
  cleanedText = cleanedText.replace(
    /\b([A-ZÁÉÍÓÚÑ]{2,}(?:\s+[A-ZÁÉÍÓÚÑ]{2,})+)\b/g,
    "[NOMBRE/ENTIDAD_OCULTA]"
  );

  // Remove index line markers
  cleanedText = cleanedText
    .split("\n")
    .filter((line) => !line.includes("[LINEA_INDICE_ELIMINADA]"))
    .join("\n");

  return cleanedText.trim();
}


