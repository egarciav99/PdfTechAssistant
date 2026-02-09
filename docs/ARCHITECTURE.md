# Arquitectura Técnica: RAG Dual para Ingeniería Eléctrica

> Documentación técnica detallada del backend n8n que procesa documentos técnicos de ingeniería eléctrica.

## 🎯 Visión General

Sistema de **RAG Dual** (Retrieval-Augmented Generation) especializado en documentos de ingeniería eléctrica. Combina ingestión documental con un chatbot contextual, usando arquitectura serverless con n8n como orquestador.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              RAG DUAL ARCHITECTURE                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌──────────────┐        ┌─────────────────┐        ┌─────────────────┐   │
│   │   CLIENTE    │───────▶│  FIREBASE       │◀───────│   n8n WORKFLOWS │   │
│   │   (React)    │        │  • Auth         │        │                 │   │
│   │              │        │  • Firestore    │        │  ┌───────────┐  │   │
│   └──────────────┘        │  • Storage      │        │  │  INGESTA  │  │   │
│                           └─────────────────┘        │  └───────────┘  │   │
│                                    │                  │  ┌───────────┐  │   │
│                                    ▼                  │  │  CHATBOT  │  │   │
│                           ┌─────────────────┐        │  └───────────┘  │   │
│                           │  CLOUD STORAGE  │        │                 │   │
│                           │   (Archivos)    │        └─────────────────┘   │
│                           └─────────────────┘                │             │
│                                                              ▼             │
│                           ┌─────────────────┐        ┌─────────────────┐   │
│                           │   SUPABASE      │◀───────│  EMBEDDINGS     │   │
│                           │  • pgvector     │        │  Gemini-004     │   │
│                           │  • Chunks       │        └─────────────────┘   │
│                           │  • Metadata     │                              │
│                           └─────────────────┘                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📥 FLUJO 1: INGESTA DE DOCUMENTOS

### Trigger
```
Webhook HTTP ← Recibe metadata desde Firebase/GCS
Payload: { fileName, bucketName, uid, docId }
```

### Pipeline de Procesamiento

#### 1. OCR con Python Externo
- **Entrada:** Archivo PDF desde GCS
- **Proceso:** Extracción de texto con OCR Python (Tesseract/PDFPlumber)
- **Salida:** Texto plano raw

#### 2. Limpieza y Anonimización (JavaScript)
```javascript
// Datos sensibles removidos:
- Emails (regex: /[\w.-]+@[\w.-]+\.\w+/)
- RFC (México): [A-ZÑ&]{3,4}\d{6}[A-V1-9][A-Z1-9]\d{?}
- Montos monetarios: \$[\d,]+\.?\d{0,2}
- Datos personales identificables (PII)
```

#### 3. Verificación de Duplicados (Supabase)
```sql
-- Query de deduplicación
SELECT id FROM documents 
WHERE file_hash = ${hash} 
  OR (filename = ${name} AND uid = ${uid})
```
- Si existe → Skip o Update
- Si nuevo → Continuar

#### 4. Vectorización con Inyección de Contexto

**Segmentación Inteligente:**
```typescript
interface Chunk {
  titulo_seccion: string;     // "Especificaciones de Cableado"
  contenido: string;          // Texto del chunk
  metadata: {
    doc_id: string;           // "01"
    filename: string;         // "proyecto_electrico.pdf"
    page_number: number;      // 5
    uid: string;              // "user123"
  }
}
```

**Inyección de Contexto:**
```
Texto a Embeddings = "Título: {titulo_seccion}\n\nContenido: {contenido}"
```

**Modelo:** `Gemini-004` (Embeddings de 768 dimensiones)

**Almacenamiento Supabase (pgvector):**
```sql
CREATE TABLE document_chunks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    content text NOT NULL,
    embedding vector(768),
    metadata jsonb,
    filename text,
    uid text,
    created_at timestamp DEFAULT now()
);

-- Index para similitud coseno
CREATE INDEX ON document_chunks 
USING ivfflat (embedding vector_cosine_ops);
```

#### 5. Generación de Resumen Técnico

**Estrategia de División:**
```
Documento → Split en 3 partes iguales
   ├── Parte 1: Introducción/Especificaciones generales
   ├── Parte 2: Detalles técnicos/Equipos
   └── Parte 3: Planos/Conclusiones
```

**Procesamiento Paralelo (Azure OpenAI):**
```yaml
Modelo: GPT-4 / Azure OpenAI
Prompt: "Extrae especificaciones eléctricas de esta sección:
         - Tipos de cableado
         - Capacidades de equipos
         - Normativas aplicables
         - Mediciones técnicas"
```

**Consolidación:**
```javascript
resumenFinal = {
  overview: parte1.summary,
  especificaciones_tecnicas: parte2.summary,
  detalles_instalacion: parte3.summary,
  consolidated_at: Date.now()
}
```

**Almacenamiento:** Firestore (`resumenes/{storageId}`)

---

## 💬 FLUJO 2: CHATBOT RAG

### Trigger
```
Webhook HTTP ← Query del usuario
Payload: { query, sessionId, fileName, docId, uid, bucketName }
```

### Pipeline de Respuesta

#### 1. Gestión de Memoria (Postgres)
```sql
-- Últimos 5 mensajes del sessionId
SELECT * FROM chat_memory 
WHERE session_id = ${sessionId} 
ORDER BY timestamp DESC 
LIMIT 5;
```

**Context Window:**
```javascript
memory = [
  { role: 'user', content: '...', timestamp: '...' },
  { role: 'assistant', content: '...', timestamp: '...' },
  // ... máximo 5 mensajes (ciclo reciente)
]
```

#### 2. Recuperación de Contexto (Supabase)
```sql
-- Buscar top 4 chunks más relevantes
SELECT content, metadata, 
       1 - (embedding <=> ${query_embedding}) as similarity
FROM document_chunks
WHERE filename = ${fileName}  -- Filtro CRÍTICO por documento
ORDER BY embedding <=> ${query_embedding}
LIMIT 4;
```

> ⚠️ **Importante:** El filtro por `filename` garantiza que solo busque en el documento activo, evitando contaminación cruzada entre documentos del usuario.

#### 3. Generación de Respuesta

**Modelo:** `Gemini 2.5 Pro` o `GPT-4`

**Prompt Engineering:**
```markdown
Contexto del documento:
[Chunk 1 relevante]
[Chunk 2 relevante]
[Chunk 3 relevante]
[Chunk 4 relevante]

Historial de conversación (últimos 5 mensajes):
[User]: ...
[Assistant]: ...

Pregunta del usuario: {query}

Instrucciones:
1. Responde basándote ÚNICAMENTE en el contexto proporcionado
2. Si la información no está en el contexto, indícalo claramente
3. Para especificaciones técnicas, usa formato tabular
4. Incluye referencias a secciones del documento cuando sea posible
5. Responde en español técnico formal
```

#### 4. Formato de Salida (HTML)

**Estructura de Respuesta:**
```html
<div class="response">
  <p>Respuesta principal en párrafos...</p>
  
  <table class="specs-table">
    <thead>
      <tr><th>Especificación</th><th>Valor</th></tr>
    </thead>
    <tbody>
      <tr><td>Tipo de cable</td><td>THW-LS 12 AWG</td></tr>
      <tr><td>Capacidad del interruptor</td><td>20A</td></tr>
      <tr><td>Normativa</td><td>NOM-001-SEDE</td></tr>
    </tbody>
  </table>
  
  <p class="reference">Referencia: Sección 3.2 - Especificaciones Técnicas</p>
</div>
```

---

## 🛠️ STACK TECNOLÓGICO

| Capa | Tecnología | Función |
|------|-----------|---------|
| **Orquestación** | n8n | Workflow automation, webhooks, LLM chaining |
| **Vector DB** | Supabase (pgvector) | Almacenamiento y búsqueda semántica |
| **Document DB** | Firestore | Metadatos, resúmenes, estructura de docs |
| **File Storage** | Google Cloud Storage | PDFs originales |
| **OCR** | Python + Tesseract/PDFPlumber | Extracción de texto |
| **Embeddings** | Gemini-004 | Vectorización (768 dim) |
| **LLM Análisis** | Azure OpenAI GPT-4 | Resúmenes técnicos estructurados |
| **LLM Chat** | Gemini 2.5 Pro / GPT-4 | Respuestas conversacionales |
| **Memoria** | PostgreSQL (Supabase) | Historial de conversación |
| **Frontend** | React + TypeScript + Tailwind | UI del usuario |

---

## ⚠️ OPTIMIZACIÓN CRÍTICA: Split In Batches

### El Problema (Anti-patrón actual)

```
[Split In Batches] → Loop secuencial:
  Iteración 1: [Insert Chunk 1] → 100ms
  Iteración 2: [Insert Chunk 2] → 100ms
  ...
  Iteración N: [Insert Chunk N] → 100ms
  
Tiempo total: O(n) donde n = número de chunks
Para 50 chunks: ~5 segundos
```

### La Solución: Batching Nativo

```
[Vector Store Insert Multiple]:
  [Chunk 1, Chunk 2, ..., Chunk N] → Batch único → 200ms
  
Tiempo total: O(1)
Para 50 chunks: ~200ms (25x más rápido)
```

### Implementación en n8n

```javascript
// ❌ ANTES (Anti-patrón)
{
  "nodes": [
    {
      "type": "n8n-nodes-base.splitInBatches",
      "parameters": { "batchSize": 1 }
    },
    {
      "type": "@n8n/n8n-nodes-langchain.vectorStoreSupabase",
      "parameters": { "mode": "insert" }
    }
  ]
}

// ✅ DESPUÉS (Optimizado)
{
  "nodes": [
    {
      "type": "@n8n/n8n-nodes-langchain.vectorStoreSupabase",
      "parameters": {
        "mode": "insert",
        "options": {
          "batchSize": 100  // Batch nativo
        }
      }
    }
  ]
}
```

### Beneficios del Batching Nativo

| Métrica | Split In Batches | Batching Nativo | Mejora |
|---------|-----------------|-----------------|--------|
| Tiempo (50 chunks) | 5,000ms | 200ms | **25x** |
| Conexiones DB | 50 | 1 | **50x** |
| Errores parciales | Posibles | Atómico | 0% |
| Rate limits API | Riesgo alto | Controlado | Seguro |

---

## 🔒 Seguridad y Privacidad

### Anonimización de Datos Sensibles

```javascript
const patterns = {
  email: /[\w.-]+@[\w.-]+\.\w+/g,
  rfc: /[A-ZÑ&]{3,4}\d{6}[A-V1-9][A-Z1-9][0-9A-Z]/g,
  monto: /\$[\d,]+\.?\d{0,2}/g,
  telefono: /\+?\d{1,3}[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g
};

// Reemplazo con tokens
const anonimizar = (texto) => {
  return texto
    .replace(patterns.email, '[EMAIL]')
    .replace(patterns.rfc, '[RFC]')
    .replace(patterns.monto, '[MONTO]')
    .replace(patterns.telefono, '[TELEFONO]');
};
```

### Filtrado Multi-tenant

```sql
-- SIEMPRE aplicar ambos filtros
WHERE filename = ${fileName} 
  AND uid = ${uid}
```

Esto garantiza:
1. **Aislamiento de documentos:** Usuario solo ve su documento activo
2. **Privacidad cross-user:** No hay filtración entre usuarios
3. **Precisión RAG:** Contexto relevante y específico

---

## 📊 Métricas y Observabilidad

### KPIs Actuales

| Métrica | Target | Actual | Estado |
|---------|--------|--------|--------|
| Ingestión (10 págs) | < 30s | ~45s | ⚠️ Mejorable con batching |
| Latencia chat (p50) | < 3s | ~2.5s | ✅ OK |
| Latencia chat (p95) | < 5s | ~4.2s | ✅ OK |
| Precisión RAG | > 85% | Pendiente | 📊 Evaluar |
| Costo por documento | < $0.10 | ~$0.08 | ✅ OK |

### Dashboard de Monitoreo

```sql
-- Queries útiles para monitoreo

-- Chunks por documento
SELECT filename, COUNT(*) as chunks 
FROM document_chunks 
GROUP BY filename;

-- Uso de memoria (últimas 24h)
SELECT COUNT(DISTINCT session_id) as active_sessions,
       AVG(message_count) as avg_conversation_length
FROM chat_memory 
WHERE timestamp > NOW() - INTERVAL '24 hours';

-- Latencia de embeddings
SELECT AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_embedding_time
FROM processing_logs;
```

---

## 🚀 Roadmap Técnico

### Inmediato (Esta semana)
- [ ] Reemplazar Split In Batches por batching nativo
- [ ] Implementar índice IVFFlat en pgvector
- [ ] Agregar retry logic con exponential backoff

### Corto Plazo (1-2 meses)
- [ ] Re-ranking de chunks (Cohere Rerank o cross-encoder)
- [ ] Búsqueda híbrida: Vector similarity + Full-text search
- [ ] Caché de embeddings frecuentes (Redis)
- [ ] Evaluación automática con RAGAS

### Largo Plazo (3-6 meses)
- [ ] Multi-modal: Procesamiento de diagramas técnicos
- [ ] Fine-tuning de embeddings para términos eléctricos
- [ ] Agentes autónomos para análisis de cumplimiento normativo
- [ ] Soporte para múltiples idiomas técnicos

---

## 📚 Referencias

- [n8n Vector Store Documentation](https://docs.n8n.io/integrations/builtin/cluster-nodes/root-nodes/n8n-nodes-langchain.vectorstoresupabase/)
- [Supabase pgvector](https://github.com/pgvector/pgvector)
- [Gemini Embeddings API](https://ai.google.dev/models/gemini)
- [Azure OpenAI Service](https://azure.microsoft.com/en-us/products/ai-services/openai-service)
- [RAG Best Practices - Anthropic](https://www.anthropic.com/news/rag-best-practices)

---

*Documento técnico mantenido por el equipo de ingeniería.*  
*Última actualización: Febrero 2024*
