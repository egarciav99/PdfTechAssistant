-- ============================================================
-- PDF Technical Assistant: título y preguntas sugeridas de la demo pública
-- Ejecutar una vez en Supabase → SQL Editor (después de 004). Idempotente.
--
-- demo_content guarda, en español e inglés, el título legible del documento de ejemplo
-- y las preguntas sugeridas que se muestran en /demo. Si cambias el PDF de la demo,
-- actualiza este JSON con otro UPDATE como el de abajo.
-- ============================================================

alter table public.organizations add column if not exists demo_content jsonb not null default '{}'::jsonb;

-- Documento de ejemplo: Endesa NRZ102 (especificación particular pública).
update public.organizations
set demo_content = $json${
  "title": {
    "es": "Endesa NRZ102 · Instalaciones privadas conectadas a la red de distribución: consumidores en alta y media tensión",
    "en": "Endesa NRZ102 · Private installations connected to the distribution grid: high and medium voltage consumers"
  },
  "suggestions": {
    "es": [
      "¿Qué diferencia hay entre suministro de socorro, de reserva y duplicado?",
      "¿Qué hay que justificar para la puesta en servicio de la instalación?",
      "¿Cómo se protegen contra sobretensiones los centros de transformación de intemperie?",
      "¿Cuándo se exige telecontrol en el centro de transformación?",
      "¿Qué elementos forman un centro de transformación de intemperie?"
    ],
    "en": [
      "What is the difference between emergency, backup and duplicate supply?",
      "What must be justified to commission the installation?",
      "How are outdoor transformer substations protected against overvoltages?",
      "When is remote control required in the transformer substation?",
      "What elements make up an outdoor transformer substation?"
    ]
  }
}$json$::jsonb
where slug = 'demo';
