# 🔧 Solución: Error de Permisos de Storage

## 🔴 Error Actual

```
Permission "storage.buckets.get" denied on "Bucket \"pdf-extract-41d23.firebasestorage.app\""
Eventarc service account has no permission
```

## ✅ Solución Rápida

Necesitas dar permisos al servicio de Eventarc para acceder a Firebase Storage.

### Opción 1: Desde Google Cloud Console (Recomendado)

1. **Abre IAM en Google Cloud Console**:
   ```
   https://console.cloud.google.com/iam-admin/iam?project=pdf-extract-41d23
   ```

2. **Encuentra la cuenta de servicio de Eventarc**:
   - Busca: `service-750080586574@gcp-sa-eventarc.iam.gserviceaccount.com`
   - Si no existe, click en "GRANT ACCESS"

3. **Agrega el rol necesario**:
   - Click en "ADD ANOTHER ROLE"
   - Busca y selecciona: **Storage Admin** o **Storage Object Viewer**
   - Click "SAVE"

4. **Vuelve a desplegar**:
   ```bash
   firebase deploy --only functions
   ```

### Opción 2: Desde la Terminal (Más Rápido)

```bash
# Obtén el número de proyecto
PROJECT_NUMBER=750080586574

# Da permisos a Eventarc
gcloud projects add-iam-policy-binding pdf-extract-41d23 \
  --member="serviceAccount:service-${PROJECT_NUMBER}@gcp-sa-eventarc.iam.gserviceaccount.com" \
  --role="roles/storage.admin"

# Da permisos adicionales si es necesario
gcloud projects add-iam-policy-binding pdf-extract-41d23 \
  --member="serviceAccount:service-${PROJECT_NUMBER}@gcp-sa-eventarc.iam.gserviceaccount.com" \
  --role="roles/eventarc.eventReceiver"

# Vuelve a desplegar
cd functions
firebase deploy --only functions
```

### Opción 3: Desde Firebase Console

1. **Abre Firebase Console**:
   ```
   https://console.firebase.google.com/project/pdf-extract-41d23/storage
   ```

2. **Ve a Rules**:
   - Click en la pestaña "Rules"
   - Asegúrate de que las reglas permitan acceso al service account

3. **Vuelve a desplegar**

## 🎯 ¿Cuál Opción Usar?

- **Opción 2 (Terminal)** - La más rápida si tienes `gcloud` instalado
- **Opción 1 (Console)** - Si prefieres interfaz gráfica
- **Opción 3** - Solo si las otras no funcionan

## 📊 Progreso Actual

- ✅ App Engine configurado
- ✅ Código compilado
- ✅ APIs habilitadas
- ✅ Functions empaquetadas (138.06 KB)
- ✅ Source code uploaded
- ❌ Permisos de Storage pendientes

## 🔄 Después de Dar Permisos

```bash
cd functions
firebase deploy --only functions
```

Deberías ver:
```
✔  functions: processDocument(us-central1) created successfully
✔  functions: chatWithDocument(us-central1) created successfully
```

## ⏱️ Tiempo Estimado

- Dar permisos: 2 minutos
- Despliegue: 3-5 minutos
- **Total: ~7 minutos**

## 🆘 Si el Error Persiste

Si después de dar permisos el error continúa:

1. Espera 2-3 minutos (los permisos tardan en propagarse)
2. Verifica que el bucket existe:
   ```bash
   gsutil ls gs://pdf-extract-41d23.firebasestorage.app
   ```
3. Intenta de nuevo
