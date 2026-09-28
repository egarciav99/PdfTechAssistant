// Pruebas de la anonimización: deno test supabase/functions/_shared/redaction.test.ts
import { redactSensitiveData } from './redaction.ts';

function assertEquals(actual: string, expected: string) {
  if (actual !== expected) throw new Error(`\nesperado: ${expected}\nobtenido: ${actual}`);
}

const redacts: Array<[string, string]> = [
  ['Contacto: correo juan.perez@empresa.es', 'Contacto: correo [EMAIL_REDACTADO]'],
  ['Tel.: 912 345 678', 'Tel.: [TELEFONO_REDACTADO]'],
  ['Teléfono 600 12 34 56', 'Teléfono [TELEFONO_REDACTADO]'],
  ['Móvil: 612345678', 'Móvil: [TELEFONO_REDACTADO]'],
  ['Llamar al +34 912 345 678 antes de ir', 'Llamar al [TELEFONO_REDACTADO] antes de ir'],
  ['o al 0034 600 123 456.', 'o al [TELEFONO_REDACTADO].'],
  ['Oficina (55) 1234 5678', 'Oficina [TELEFONO_REDACTADO]'],
  ['Directo 55-1234-5678', 'Directo [TELEFONO_REDACTADO]'],
  ['Su número es 612345678.', 'Su número es [TELEFONO_REDACTADO].'],
  ['DNI 12345678Z del titular', 'DNI [DNI_REDACTADO] del titular'],
  ['NIE X1234567L', 'NIE [DNI_REDACTADO]'],
  ['CIF B12345674 de la sociedad', 'CIF [CIF_REDACTADO] de la sociedad'],
  ['IBAN ES91 2100 0418 4502 0005 1332', 'IBAN [IBAN_REDACTADO]'],
  ['RFC GODE561231GR8', 'RFC [RFC_REDACTADO]'],
  ['Presupuesto: 12.500,00 €', 'Presupuesto: [MONTO_REDACTADO]'],
  ['Importe € 1.200', 'Importe [MONTO_REDACTADO]'],
  ['Oficinas en C/ Mayor 12, 3º', 'Oficinas en [DIRECCION_REDACTADA]'],
  ['Entrega en Calle Alcalá, 45', 'Entrega en [DIRECCION_REDACTADA]'],
  ['Sede en Paseo de la Castellana, 100', 'Sede en [DIRECCION_REDACTADA]'],
  ['Domicilio: Avenida Reforma 222, CDMX', 'Domicilio: [DIRECCION_REDACTADA]'],
  ['Nombre: María López', 'Nombre: [NOMBRE_REDACTADO]'],
];

// Texto técnico que no debe cambiar.
const keeps = [
  'Tensión nominal 13.200 V, primaria 16.500 V y 22.000 V',
  '2,5 6 38 9 64 10 71 12 85\n5 11 77 18 129 20 142 23 171\n60 125 934 208 1.557 229 1.712 275 2.055',
  '778 115 856 229 1.557',
  'Norma UNE-EN 60099-4 y UNE-IEC/TR 61000-3-6',
  'intensidad de 25 kA durante 1 s; Icc<8kA',
  'el apartado 5.2.3.3 y el punto 7.2.3',
  'DNI 12345678A con letra incorrecta',
  'un telecontrol en la calle de acceso',
  'transformador de 1000 kVA y 630 kVA',
  'Código 12345678 del pedido',
  'Contacto: correo o teléfono de la distribuidora',
];

for (const [input, expected] of redacts) {
  Deno.test(`anonimiza: ${input}`, () => assertEquals(redactSensitiveData(input), expected));
}
for (const input of keeps) {
  Deno.test(`no toca: ${input.slice(0, 40)}`, () => assertEquals(redactSensitiveData(input), input));
}
