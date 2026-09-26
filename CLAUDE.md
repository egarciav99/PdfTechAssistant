# Reglas de trabajo para Elier Garcia / EG Solutions

Estas reglas se aplican siempre, en este repo y en cualquier otro de Elier (egarciav99/*).
Cada repo tiene una copia de este archivo; si cambias las reglas, actualízalas todas.

## Escritura (OBLIGATORIO, sin excepciones)

- PROHIBIDO usar guiones largos (—) o guiones medios (–) en cualquier texto:
  copy de la web, strings de UI, correos, títulos, meta tags, comentarios de
  código, mensajes de commit y respuestas en el chat.
- Motivo: suenan a texto generado por IA.
- Sustitúyelos por: coma, punto, dos puntos, paréntesis o un punto medio (·)
  en taglines. Ejemplo: "EG Solutions · Desarrollo Web" en lugar de
  "EG Solutions — Desarrollo Web".
- Antes de dar por terminada cualquier tarea, busca "—" y "–" en los archivos
  modificados y reemplázalos. Si encuentras guiones largos ya existentes en
  archivos que estás tocando, corrígelos también.
- Notación numérica española: punto para miles y coma para decimales
  (36.000 y 54,7, nunca 36,000 ni 54.7) en todo texto visible para el usuario.
- Idioma por defecto: español.

## Marca

- Todo producto construido bajo EG Solutions debe incluir un crédito
  "creada por EG Solutions" con enlace a la web de EG Solutions.

## Cómo se aplican (criterios acordados)

- Excepción acordada con Elier: en rangos de fechas sí se usa el guion ("Ene 2024 — Feb 2025", "2026 — hoy"),
  sobre todo en el CV. En ningún otro caso.
- Rangos numéricos que no son fechas: guion normal ("1-2 semanas", "90-115").
- El guion normal (-) sí está permitido: palabras compuestas, rangos, nombres de archivo, código.
- Nombres de producto o versión se dejan como son ("Gemini 2.5 Flash").
- Comprobación rápida antes de terminar: `grep -rn "[—–]" <archivos modificados>`; solo pueden quedar rangos de fechas (y este archivo, que cita los caracteres).
