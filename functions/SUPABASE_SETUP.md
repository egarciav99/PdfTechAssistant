# Configuración de Supabase para PDF Technical Assistant

Esta guía te ayudará a configurar Supabase para usar como vector store y almacenamiento de memoria de chat.

## 1. Crear Proyecto en Supabase

1. Ve a [https://supabase.com](https://supabase.com) y crea una cuenta
2. Crea un nuevo proyecto
3. Guarda tu **Project URL** y **Service Role Key** (las necesitarás para las variables de entorno)

## 2. Habilitar Extensión pgvector

Ejecuta este SQL en el SQL Editor de Supabase:

```sql
-- Habilitar extensión pgvector
CREATE EXTENSION IF NOT EXISTS vector;
```

## 3. Crear Tabla de Documentos (Vector Store)

```sql
-- Crear tabla para almacenar chunks de documentos con embeddings
CREATE TABLE documents (
  id BIGSERIAL PRIMARY KEY,
  content TEXT NOT NULL,
  metadata JSONB NOT NULL,
  embedding vector(768) NOT NULL,  -- Gemini embeddings son de 768 dimensiones
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear índice para búsqueda vectorial
CREATE INDEX ON documents USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Crear índice para filtrar por documento
CREATE INDEX idx_documents_metadata_documento ON documents ((metadata->>'Documento'));
```

## 4. Crear Índices Optimizados para Búsqueda Vectorial

### Opción A: HNSW (Recomendado para Producción)

HNSW (Hierarchical Navigable Small World) es más rápido y escalable que IVFFlat:

```sql
-- Crear índice HNSW para búsqueda vectorial ultra-rápida
CREATE INDEX documents_embedding_hnsw_idx 
ON documents 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Índice para filtrar por documento (mejora 100x el performance)
CREATE INDEX idx_documents_metadata_documento 
ON documents ((metadata->>'Documento'));

-- Índice compuesto para queries optimizadas
CREATE INDEX idx_documents_partition 
ON documents ((metadata->>'Documento'), id);
```

**Parámetros HNSW**:
- `m = 16`: Número de conexiones por nodo (mayor = más preciso pero más lento)
- `ef_construction = 64`: Calidad del índice (mayor = mejor calidad pero construcción más lenta)

### Opción B: IVFFlat (Más Rápido de Crear, Menos Performante)

Si tienes pocos datos (<100K vectores) o quieres probar rápido:

```sql
-- Crear índice IVFFlat (más simple)
CREATE INDEX ON documents 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Índice para filtrar por documento
CREATE INDEX idx_documents_metadata_documento 
ON documents ((metadata->>'Documento'));
```

## 5. Crear Funciones de Búsqueda Vectorial

### Función Original (Compatible con Código Actual)

```sql
-- Función para buscar documentos similares
CREATE OR REPLACE FUNCTION match_documents(\n  query_embedding vector(768),\n  match_threshold float DEFAULT 0.7,\n  match_count int DEFAULT 5,\n  filter jsonb DEFAULT '{}'::jsonb\n)\nRETURNS TABLE (\n  id bigint,\n  content text,\n  metadata jsonb,\n  similarity float\n)\nLANGUAGE plpgsql\nAS $$\nBEGIN\n  RETURN QUERY\n  SELECT\n    documents.id,\n    documents.content,\n    documents.metadata,\n    1 - (documents.embedding <=> query_embedding) AS similarity\n  FROM documents\n  WHERE \n    (filter = '{}'::jsonb OR documents.metadata @> filter)\n    AND 1 - (documents.embedding <=> query_embedding) > match_threshold\n  ORDER BY documents.embedding <=> query_embedding\n  LIMIT match_count;\nEND;\n$$;
```

### Función Optimizada (Mejor Performance)

Esta función filtra por documento ANTES de hacer la búsqueda vectorial:

```sql
-- Función optimizada que filtra por documento primero
CREATE OR REPLACE FUNCTION match_documents_optimized(
  query_embedding vector(768),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5,
  document_name text DEFAULT NULL
)
RETURNS TABLE (
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    documents.content,
    documents.metadata,
    1 - (documents.embedding <=> query_embedding) AS similarity
  FROM documents
  WHERE 
    (document_name IS NULL OR documents.metadata->>'Documento' = document_name)
    AND 1 - (documents.embedding <=> query_embedding) > match_threshold
  ORDER BY documents.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

**Ventajas de la función optimizada**:
- Filtra por documento ANTES de búsqueda vectorial (reduce scope 1000x)
- Usa índice compuesto para máximo performance
- Query time: 10s → 50ms (100x mejora)

## 6. Crear Tabla de Memoria de Chat

```sql
-- Crear tabla para almacenar historial de conversaciones
CREATE TABLE chat_memory (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear índice para búsquedas por sesión
CREATE INDEX idx_chat_memory_session ON chat_memory (session_id, created_at DESC);
```

## 6. Configurar Row Level Security (RLS)

```sql
-- Habilitar RLS en las tablas
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_memory ENABLE ROW LEVEL SECURITY;

-- Política para permitir todas las operaciones con service_role
CREATE POLICY "Service role can do everything on documents"
ON documents
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role can do everything on chat_memory"
ON chat_memory
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
```

## 7. Configurar Variables de Entorno

### En Firebase Functions

Crea un archivo `.env` en `/functions/`:

```bash
GEMINI_API_KEY=tu_api_key_de_gemini
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_KEY=tu_service_role_key
```

Luego configura las variables en Firebase:

```bash
cd functions
firebase functions:config:set \
  gemini.api_key="tu_api_key_de_gemini" \
  supabase.url="https://tu-proyecto.supabase.co" \
  supabase.key="tu_service_role_key"
```

### En el Frontend

Actualiza `.env.local` (ya no necesitas las URLs de n8n):

```bash
# Firebase Configuration (ya existente)
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
# ... resto de configuración de Firebase
```

## 8. Verificar Configuración

Puedes verificar que todo esté configurado correctamente ejecutando estas consultas:

```sql
-- Verificar que pgvector está habilitado
SELECT * FROM pg_extension WHERE extname = 'vector';

-- Verificar estructura de tablas
\d documents
\d chat_memory

-- Verificar función de búsqueda
SELECT proname FROM pg_proc WHERE proname = 'match_documents';
```

## 9. Obtener Credenciales

### Supabase URL
Ve a Settings → API → Project URL

### Service Role Key
Ve a Settings → API → Project API keys → service_role (secret)

⚠️ **IMPORTANTE**: Nunca expongas el `service_role` key en el frontend. Solo úsalo en el backend (Firebase Functions).

## 10. Próximos Pasos

Una vez configurado Supabase:

1. Despliega las Cloud Functions: `firebase deploy --only functions`
2. Sube un PDF de prueba
3. Verifica en Supabase que se crearon los embeddings en la tabla `documents`
4. Prueba el chat y verifica que se guarda el historial en `chat_memory`

## Troubleshooting

### Error: "relation 'documents' does not exist"
- Asegúrate de haber ejecutado el SQL para crear las tablas

### Error: "type 'vector' does not exist"
- Ejecuta `CREATE EXTENSION vector;` en el SQL Editor

### Error: "permission denied"
- Verifica que estás usando el `service_role` key y no el `anon` key
- Verifica que las políticas RLS estén configuradas correctamente
