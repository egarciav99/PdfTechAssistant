/**
 * Genera test/fixtures/especificacion.pdf: un PDF mínimo y genérico para las pruebas
 * (sin datos reales). Uso: node test/fixtures/make-pdf.mjs
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const lines = [
  '1. Alcance general',
  'Tablero principal TG-1 de 225 A, 3 fases, 4 hilos, 220/127 V.',
  'Alimentador principal con cable de cobre calibre 4/0 AWG THHW-LS.',
  '2. Canalizacion',
  'Tuberia conduit de acero galvanizado pared gruesa de 53 mm.',
  'Contacto de obra: residente@ejemplo.com',
];
const esc = (s) => s.replace(/[\\()]/g, (c) => `\\${c}`);
const stream = ['BT', '/F1 12 Tf', '72 720 Td', '16 TL', ...lines.map((l) => `(${esc(l)}) Tj T*`), 'ET'].join('\n');
const objects = [
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
  `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
];
let pdf = '%PDF-1.4\n';
const offsets = [];
objects.forEach((body, i) => {
  offsets.push(Buffer.byteLength(pdf));
  pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
});
const xref = Buffer.byteLength(pdf);
pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
pdf += offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('');
pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
writeFileSync(fileURLToPath(new URL('./especificacion.pdf', import.meta.url)), pdf);
