# Guía de Despliegue - Firebase Functions

## ✅ Pre-requisitos Completados

- ✅ Código migrado de n8n a Firebase Functions
- ✅ Código Python (PyMuPDF) migrado a TypeScript (pdf.js-extract)
- ✅ Build compilado exitosamente
- ✅ Todas las dependencias instaladas

## 📋 Pasos para Desplegar

### 1. Configurar Supabase

Sigue la guía detallada en [SUPABASE_SETUP.md](./SUPABASE_SETUP.md)

**Resumen rápido**:
```sql
-- Habilitar pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Crear tabla documents
CREATE TABLE documents (
  id BIGSERIAL PRIMARY KEY,
  content TEXT NOT NULL,
  metadata JSONB NOT NULL,
  embedding vector(768) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear tabla chat_memory
CREATE TABLE chat_memory (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear función de búsqueda
CREATE OR REPLACE FUNCTION match_documents(...) ...
```

### 2. Obtener Credenciales

#### Gemini API Key
1. Ve a https://aistudio.google.com/app/apikey
2. Crea una nueva API key
3. Guárdala de forma segura

#### Supabase Credentials
1. Ve a tu proyecto en Supabase
2. Settings → API
3. Copia:
   - **Project URL** (ej: `https://xxxxx.supabase.co`)
   - **Service Role Key** (secret, no el anon key)

### 3. Configurar Variables de Entorno

Crea el archivo `.env` en `/functions/`:

```bash
cd functions
cat > .env << 'EOF'
GEMINI_API_KEY=tu_gemini_api_key_aqui
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_KEY=tu_service_role_key_aqui
EOF
```

**⚠️ IMPORTANTE**: Nunca subas el archivo `.env` a Git. Ya está en `.gitignore`.

### 4. Configurar Firebase Functions Config (Producción)

Para que las variables estén disponibles en producción:

```bash
cd functions

firebase functions:config:set \
  gemini.api_key="tu_gemini_api_key" \
  supabase.url="https://tu-proyecto.supabase.co" \
  supabase.key="tu_service_role_key"
```

Verificar configuración:
```bash
firebase functions:config:get
```

### 5. Actualizar Código para Usar Config en Producción

Los servicios ya están configurados para leer de `process.env` en desarrollo y de `functions.config()` en producción.

### 6. Desplegar Functions

```bash
cd functions

# Build (ya compilado)
npm run build

# Desplegar
firebase deploy --only functions
```

Esto desplegará:
- `processDocument` - Trigger de Storage
- `chatWithDocument` - HTTP endpoint

### 7. Verificar Despliegue

```bash
# Ver logs en tiempo real
firebase functions:log --only processDocument,chatWithDocument

# O en Firebase Console
# https://console.firebase.google.com/project/TU_PROJECT_ID/functions
```

## 🧪 Probar el Sistema

### Prueba 1: Procesamiento de Documentos

1. Abre tu aplicación React
2. Sube un PDF de prueba
3. Verifica en Firebase Console → Functions → Logs:
   ```
   Processing document: UID_filename.pdf
   Extracting text from PDF...
   Cleaning and anonymizing text...
   Generating embeddings for X segments...
   Document processed successfully
   ```
4. Verifica en Supabase → Table Editor → `documents`:
   - Debe haber múltiples filas
   - Columna `embedding` debe tener valores
5. Verifica en Firestore → `resumenes`:
   - Debe existir documento con el resumen HTML

### Prueba 2: Chat con Documentos

1. Abre el chat con un documento procesado
2. Haz una pregunta: "¿Qué especificaciones eléctricas menciona?"
3. Verifica en Functions logs:
   ```
   Chat request from user UID for document filename.pdf
   ```
4. Verifica en Supabase → `chat_memory`:
   - Debe haber 2 filas nuevas (user + assistant)
5. Verifica la respuesta en la UI:
   - Debe ser HTML formateado
   - Debe contener información del documento

## 🔧 Comandos Útiles

```bash
# Ver logs en tiempo real
firebase functions:log

# Ver logs de una función específica
firebase functions:log --only processDocument

# Desplegar solo una función
firebase deploy --only functions:processDocument

# Eliminar una función
firebase functions:delete processDocument

# Ver estado de las functions
firebase functions:list
```

## 🐛 Troubleshooting

### Error: "GEMINI_API_KEY is not defined"
```bash
# Verifica que las variables estén configuradas
firebase functions:config:get

# Si no están, configúralas:
firebase functions:config:set gemini.api_key="tu_key"
```

### Error: "Cannot connect to Supabase"
- Verifica que la URL sea correcta (debe empezar con `https://`)
- Verifica que uses el `service_role` key, no el `anon` key
- Verifica que las tablas existan en Supabase

### Error: "Permission denied" en Supabase
- Verifica las políticas RLS en Supabase
- Asegúrate de que las políticas permitan acceso al `service_role`

### Function timeout
- PDFs muy grandes pueden exceder 9 minutos
- Considera aumentar el timeout o dividir el procesamiento

### Error: "pdf.js-extract" no funciona
- Verifica que la dependencia esté instalada: `npm list pdf.js-extract`
- Reinstala si es necesario: `npm install pdf.js-extract`

## 📊 Monitoreo

### Firebase Console
- Functions → Logs: Ver ejecuciones y errores
- Functions → Usage: Ver uso y costos
- Firestore → Data: Ver resúmenes guardados

### Supabase Dashboard
- Table Editor → documents: Ver embeddings
- Table Editor → chat_memory: Ver historial de chat
- SQL Editor: Ejecutar queries de análisis

## 💰 Costos Estimados

### Firebase Functions (Plan Blaze)
- **Invocaciones**: 2M gratis/mes, luego $0.40/M
- **GB-segundos**: 400K gratis/mes
- **CPU-segundos**: 200K gratis/mes
- **Egress**: 5GB gratis/mes

### Gemini API
- **Embeddings**: Gratis hasta cierto límite
- **Chat**: Según modelo usado

### Supabase
- **Plan Free**: 500MB DB, 1GB transferencia/mes
- **Plan Pro**: $25/mes con más recursos

**Estimación para uso moderado**: Gratis o < $10/mes

## 🚀 Próximos Pasos Opcionales

1. **Configurar CI/CD**: Automatizar despliegue con GitHub Actions
2. **Agregar tests**: Unit tests para las functions
3. **Monitoreo avanzado**: Integrar con Cloud Monitoring
4. **Optimizaciones**: Caché de embeddings, procesamiento paralelo
5. **Eliminar n8n**: Ya no es necesario

## ✅ Checklist Final

- [ ] Supabase configurado (tablas + función RPC)
- [ ] Gemini API Key obtenida
- [ ] Variables de entorno configuradas
- [ ] Build compilado (`npm run build`)
- [ ] Functions desplegadas (`firebase deploy`)
- [ ] Prueba de upload de PDF exitosa
- [ ] Prueba de chat exitosa
- [ ] Logs verificados sin errores
- [ ] Datos en Supabase verificados
- [ ] Frontend actualizado y funcionando
