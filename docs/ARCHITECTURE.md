# Arquitectura

## Componentes

- React + Vite: interfaz y hooks de aplicación.
- Supabase Auth: identidad y sesiones del usuario.
- Supabase Storage: bucket privado `documents`, con rutas `{user_id}/{uuid}_{filename}`.
- Postgres + RLS: `user_documents`, estados, resúmenes, sesiones y mensajes.
- pgvector: `document_chunks.embedding` de 768 dimensiones.
- Supabase Edge Functions: `process-document` y `chat-with-document`.
- Gemini: embeddings, resumen y generación de respuestas HTML.

## Procesamiento

1. El usuario sube el PDF a Storage.
2. El frontend crea un registro en `user_documents`.
3. Invoca `process-document` con el JWT del usuario.
4. La función valida ownership, descarga el PDF, extrae texto y crea chunks.
5. Genera embeddings con Gemini y los guarda en `document_chunks`.
6. Genera el resumen y lo guarda en `summaries`.
7. Actualiza `user_documents.status` a `ready` o `error`.

## Chat RAG

1. El frontend invoca `chat-with-document` con `query`, `sessionId` y `documentId`.
2. La función valida el JWT y que el documento pertenece al usuario.
3. Recupera hasta 10 mensajes recientes de `chat_messages`.
4. Gemini usa la herramienta `search_document_chunks`.
5. La RPC `match_document_chunks` filtra simultáneamente por `document_id`, `user_id` y similitud vectorial.
6. La respuesta se limita a evidencia del documento y se almacena como memoria.

## Seguridad

La `anon key` solo se usa en el frontend. Las políticas RLS aíslan todos los registros por `auth.uid()`. `SUPABASE_SERVICE_ROLE_KEY` y `GEMINI_API_KEY` solo viven como secretos de Edge Functions.

## Despliegue

```bash
npx supabase link --project-ref <PROJECT_REF>
npx supabase db push
npx supabase secrets set GEMINI_API_KEY=<GEMINI_KEY>
npx supabase functions deploy process-document
npx supabase functions deploy chat-with-document
```
