# PDF Technical Assistant

Aplicación React para subir PDFs técnicos, generar resúmenes de ingeniería eléctrica y conversar con evidencia mediante RAG.

## Arquitectura

```text
React + Supabase Auth
        |
        +-- Supabase Storage (PDF)
        +-- Postgres + RLS (documentos, resúmenes, memoria)
        +-- pgvector (chunks y embeddings)
        +-- Edge Functions (procesamiento y chat)
                         |
                         +-- Google Gemini (embeddings y generación)
```

## Configuración local

Requisitos: Node.js 18+, un proyecto Supabase y una clave de Gemini.

```bash
npm install
npx supabase login
npx supabase link --project-ref <PROJECT_REF>
npx supabase db push
npx supabase secrets set GEMINI_API_KEY=<GEMINI_KEY>
npx supabase functions deploy process-document
npx supabase functions deploy chat-with-document
```

Crea `.env.local`:

```env
VITE_SUPABASE_URL=https://<PROJECT_REF>.supabase.co
VITE_SUPABASE_ANON_KEY=<SUPABASE_ANON_KEY>
```

La clave `service_role` y `GEMINI_API_KEY` solo se configuran como secretos de Edge Functions. Nunca deben estar en el frontend.

## Ejecución

```bash
npm run dev
```

La migración [supabase/migrations/001_initial_schema.sql](supabase/migrations/001_initial_schema.sql) crea `user_documents`, chunks, resúmenes, memoria, RLS, bucket privado y la función de búsqueda vectorial. Usa `user_documents` para no colisionar con la tabla vectorial `documents` de instalaciones anteriores. La subida invoca `process-document`; el chat invoca `chat-with-document`.

## Pruebas y build

```bash
npm test
npm run build
```

## Estructura relevante

```text
components/                 UI
hooks/                      Auth, documentos y chat
services/supabase.ts        Cliente Supabase y operaciones CRUD
supabase/migrations/        Esquema Postgres/RLS/pgvector
supabase/functions/         Procesamiento PDF y agente RAG
```

## Seguridad

Las tablas y los archivos se aíslan por `auth.uid()`. La función de chat verifica que el documento y la sesión pertenecen al usuario autenticado antes de consultar pgvector o guardar memoria.
