/**
 * Anonimización de datos personales antes de indexar un documento o enviarlo al modelo.
 * Cubre formatos de España y México. Los documentos técnicos están llenos de números
 * (tablas, tensiones, potencias), así que los teléfonos solo se reconocen con contexto
 * claro (etiqueta, prefijo internacional o formato inequívoco) y nunca uniendo líneas.
 */

const DNI_LETTERS = 'TRWAGMYFPDXBNJZSQVHLCKE';

/** DNI (8 dígitos + letra) o NIE (X/Y/Z + 7 dígitos + letra) con la letra de control correcta. */
function isValidDniNie(value: string): boolean {
  const clean = value.replace(/[\s-]/g, '').toUpperCase();
  const nie = clean.match(/^([XYZ])(\d{7})([A-Z])$/);
  const dni = clean.match(/^(\d{8})([A-Z])$/);
  if (nie) return DNI_LETTERS[Number('XYZ'.indexOf(nie[1]) + nie[2]) % 23] === nie[3];
  if (dni) return DNI_LETTERS[Number(dni[1]) % 23] === dni[2];
  return false;
}

/** CIF / NIF de empresa: letra + 7 dígitos + dígito o letra de control correctos. */
function isValidCif(value: string): boolean {
  const clean = value.replace(/[\s-]/g, '').toUpperCase();
  const match = clean.match(/^([ABCDEFGHJNPQRSUVW])(\d{7})([0-9A-J])$/);
  if (!match) return false;
  const digits = match[2];
  let sum = 0;
  for (let i = 0; i < 7; i++) {
    const n = Number(digits[i]);
    if (i % 2 === 0) {
      const doubled = n * 2;
      sum += Math.floor(doubled / 10) + (doubled % 10);
    } else {
      sum += n;
    }
  }
  const control = (10 - (sum % 10)) % 10;
  return match[3] === String(control) || match[3] === 'JABCDEFGHI'[control];
}

type Rule = [RegExp, string | ((match: string, ...groups: string[]) => string)];

const PHONE_LABEL = String.raw`(?:tel(?:[eé]fono|f)?|m[oó]vil|celular|cel|fax|phone|whatsapp)`;

const REDACTION_RULES: Rule[] = [
  [/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[EMAIL_REDACTADO]'],

  // IBAN (España y resto de Europa).
  [/\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{4}){4,7}(?:[ ]?[A-Z0-9]{1,3})?\b/g, (m) => (/^ES\d{2}/.test(m) || m.replace(/ /g, '').length >= 20 ? '[IBAN_REDACTADO]' : m)],

  // Teléfonos con etiqueta: se conserva la etiqueta.
  [new RegExp(String.raw`\b(${PHONE_LABEL}\.?\s*[:.]?[ \t]*)(?:\+\d{1,3}[ .-]?)?(?:\(?\d{1,4}\)?[ .-]?){1,4}\d{2,4}`, 'gi'), (_m, label) => `${label}[TELEFONO_REDACTADO]`],
  // Teléfonos con prefijo internacional (+34, 0034, +52...).
  [/(?<![\w+])(?:\+|00)\d{1,3}[ .-]?(?:\(?\d{1,4}\)?[ .-]?){2,4}\d{2,4}(?!\d)/g, '[TELEFONO_REDACTADO]'],
  // México: (55) 1234 5678 o 55-1234-5678.
  [/\(\d{2,3}\)[ .-]?\d{3,4}[ .-]?\d{4}(?!\d)/g, '[TELEFONO_REDACTADO]'],
  [/(?<![\d.,-])\d{2,3}-\d{3,4}-\d{4}(?![\d-])/g, '[TELEFONO_REDACTADO]'],
  // España sin separadores: 9 dígitos que empiezan por 6, 7, 8 o 9.
  [/(?<![\d.,])[6789]\d{8}(?!\d|[.,]\d)/g, '[TELEFONO_REDACTADO]'],

  // Identificadores: DNI, NIE y CIF de España (con control), RFC de México e ID fiscal con etiqueta.
  [/(?<![A-Z0-9])[XYZ][ -]?\d{7}[ -]?[A-Z](?![A-Z0-9])/gi, (m) => (isValidDniNie(m) ? '[DNI_REDACTADO]' : m)],
  [/(?<![A-Z0-9])\d{8}[ -]?[A-Z](?![A-Z0-9])/gi, (m) => (isValidDniNie(m) ? '[DNI_REDACTADO]' : m)],
  [/(?<![A-Z0-9])[ABCDEFGHJNPQRSUVW][ -]?\d{7}[ -]?[0-9A-J](?![A-Z0-9])/g, (m) => (isValidCif(m) ? '[CIF_REDACTADO]' : m)],
  [/(?<![A-Z0-9])[A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3}(?![A-Z0-9])/gi, '[RFC_REDACTADO]'],
  [/(?<![A-Z0-9])[A-Z0-9-]{8,20}(?:\s+ID)?\s*(?:fiscal|tributario|tax)(?![A-Z0-9])/gi, '[ID_FISCAL_REDACTADO]'],

  // Importes con moneda.
  [/(?<!\w)(?:[$€£]\s?|USD\s*|MXN\s*|EUR\s*)\d{1,3}(?:[,.]\d{3})*(?:[,.]\d{2})?(?!\w)/gi, '[MONTO_REDACTADO]'],
  [/(?<!\w)\d{1,3}(?:[,.]\d{3})*(?:[,.]\d{2})?\s*(?:€|USD|MXN|EUR|euros?|dólares?|pesos?)(?!\w)/gi, '[MONTO_REDACTADO]'],

  // Direcciones: con etiqueta, o con tipo de vía seguido de un nombre propio (en mayúscula).
  [/\b((?:domicilio|dirección|direccion|address|ubicación|ubicacion)\s*:\s*)[^\n.;]{8,}/gi, (_m, label) => `${label}[DIRECCION_REDACTADA]`],
  [/(?:\b(?:[Cc]alle|CALLE|[Aa]venida|AVENIDA|[Aa]vda?\.|AVDA?\.|[Aa]v\.|[Pp]laza|PLAZA|[Pp]za\.|[Pp]aseo|PASEO|P[ºo]\.|[Cc]amino|[Rr]onda|[Tt]ravesía|[Gg]lorieta|[Cc]arrer|[Bb]lvd\.?|[Bb]oulevard|[Cc]arretera|[Cc]arr\.)|(?<![\w/])[Cc]\/)[ \t]*(?:de(?:l| la| los| las)?[ \t]+)?[A-ZÁÉÍÓÚÑ][^\n,;]{2,40}(?:,[ \t]*(?:#|n\.?º|nº|no\.?|núm\.?|número)?[ \t]*\d+[A-Za-zºª]?)?/g, '[DIRECCION_REDACTADA]'],
];

// Nombres de persona solo cuando van tras una etiqueta explícita.
// La etiqueta admite mayúsculas o minúsculas; el nombre tiene que empezar en mayúscula.
const LABELED_PERSON_PATTERN = /\b(?:[Nn]ombre|NOMBRE|[Nn]ame|NAME|[Cc]ontacto|CONTACTO|[Cc]ontact|CONTACT|[Aa]tenci[oó]n|ATENCI[OÓ]N|[Aa] la atenci[oó]n|[Aa]ttn\.?)\s*:\s*[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+){0,3}/g;

export function redactSensitiveData(text: string): string {
  let redacted = text;
  for (const [pattern, replacement] of REDACTION_RULES) {
    redacted = redacted.replace(pattern, replacement as any);
  }
  return redacted.replace(LABELED_PERSON_PATTERN, (match) => {
    const separator = match.indexOf(':');
    return separator >= 0
      ? `${match.slice(0, separator + 1)} [NOMBRE_REDACTADO]`
      : '[NOMBRE_REDACTADO]';
  });
}
