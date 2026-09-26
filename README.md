# PDF Technical Assistant

Asistente multiempresa para documentación técnica: cada empresa sube sus PDF, obtiene resúmenes y conversa con ellos mediante RAG, con el enfoque de su especialidad (eléctrica, civil, mecánica, hidrosanitaria, arquitectura o general). Interfaz en español e inglés.

- **Roles:** superadmin (crea empresas y entra en cualquiera), admin de empresa (documentos, usuarios, nombre, logo y especialidad) y usuario (sube y consulta; sus chats son privados).
- **Acceso:** solo por invitación.
- **Entrega:** como SaaS o instalado en la empresa con Docker. Ver **[docs/ENTREGA.md](docs/ENTREGA.md)**.

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

Requisitos: Node.js 22+, un proyecto Supabase y una clave de Gemini.

```bash
npm install
npx supabase login
npx supabase link --project-ref <PROJECT_REF>
npx supabase db push
npx supabase secrets set GEMINI_API_KEY=<GEMINI_KEY>
npx supabase functions deploy process-document
npx supabase functions deploy chat-with-document
npx supabase functions deploy manage-members
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

La migración [001_initial_schema.sql](supabase/migrations/001_initial_schema.sql) crea `user_documents`, chunks, resúmenes, memoria, bucket privado y la función de búsqueda vectorial. [003_multiempresa.sql](supabase/migrations/003_multiempresa.sql) añade empresas, roles y RLS por empresa, y pasa los datos existentes a una empresa personal de su dueño. La subida invoca `process-document`; el chat invoca `chat-with-document`; las invitaciones y los roles, `manage-members`.

## Pruebas y build

```bash
npm test -- --run          # unitarias
npm run build
```

Las pruebas de RLS, de las funciones y la E2E en Chromium usan Supabase local: ver [docs/ENTREGA.md → Pruebas](docs/ENTREGA.md#pruebas-supabase-local).

## Estructura relevante

```text
components/                 UI (components/admin: usuarios, empresa y empresas)
hooks/                      Auth, empresas, documentos y chat
services/                   Cliente Supabase, documentos, empresas y miembros
locales/                    Textos en español e inglés
config.ts, public/config.json  Configuración en tiempo de ejecución
deploy/, Dockerfile         Imagen Docker (Nginx) para instalar en la empresa
supabase/migrations/        Esquema Postgres/RLS/pgvector
supabase/functions/         Procesamiento PDF y agente RAG
```

## Seguridad

Las tablas y los archivos se aíslan por empresa con RLS (`is_org_member`, `is_org_admin`). Las conversaciones, además, por usuario. Las Edge Functions comprueban que el usuario pertenece a la empresa del documento antes de procesar o responder. Los datos personales se anonimizan antes de indexar.
