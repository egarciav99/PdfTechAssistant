const REDACTION_RULES: Array<[RegExp, string]> = [
  [/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[EMAIL_REDACTADO]'],
  [/(?<!\d)(?:\+?\d{1,3}[\s.-])?(?:\(?\d{2,4}\)?[\s.-])\d{3,4}[\s.-]\d{3,4}(?!\d)/g, '[TELEFONO_REDACTADO]'],
  [/(?<![A-Z0-9])[A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3}(?![A-Z0-9])/gi, '[RFC_REDACTADO]'],
  [/(?<![A-Z0-9])[A-Z0-9-]{8,20}(?:\s+ID)?\s*(?:fiscal|tributario|tax)(?![A-Z0-9])/gi, '[ID_FISCAL_REDACTADO]'],
  [/(?<!\w)(?:[$€£]\s?|USD\s*|MXN\s*|EUR\s*)\d{1,3}(?:[,.]\d{3})*(?:[,.]\d{2})?(?!\w)/gi, '[MONTO_REDACTADO]'],
  [/(?<!\w)\d{1,3}(?:[,.]\d{3})*(?:[,.]\d{2})?\s*(?:USD|MXN|EUR|dólares?|pesos?)(?!\w)/gi, '[MONTO_REDACTADO]'],
  [/\b(?:domicilio|dirección|direccion|address|ubicación|ubicacion)\s*:\s*[^\n.;]{8,}/gi, '[DIRECCION_REDACTADA]'],
  [/\b(?:calle|avenida|av\.?|blvd\.?|boulevard|carretera|carr\.?)\s+[A-ZÁÉÍÓÚÑ0-9][^\n,;]{3,}(?:,\s*(?:#|no\.?|número)\s*\d+)?/gi, '[DIRECCION_REDACTADA]'],
];

// Only redact names when introduced by an explicit person-oriented label.
const LABELED_PERSON_PATTERN = /\b(?:nombre|name|contacto|contact|atención|atencion|a la atención|attn\.?)\s*:\s*[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ]+){0,3}/gi;

export function redactSensitiveData(text: string): string {
  let redacted = text;
  for (const [pattern, replacement] of REDACTION_RULES) {
    redacted = redacted.replace(pattern, replacement);
  }
  return redacted.replace(LABELED_PERSON_PATTERN, (match) => {
    const separator = match.indexOf(':');
    return separator >= 0
      ? `${match.slice(0, separator + 1)} [NOMBRE_REDACTADO]`
      : '[NOMBRE_REDACTADO]';
  });
}
