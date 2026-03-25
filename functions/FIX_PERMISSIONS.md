# 🎯 Solución Rápida - Permisos de Storage

## Ejecuta estos comandos:

```bash
# 1. Da permisos de Storage a Eventarc
gcloud projects add-iam-policy-binding pdf-extract-41d23 \
  --member="serviceAccount:service-750080586574@gcp-sa-eventarc.iam.gserviceaccount.com" \
  --role="roles/storage.admin"

# 2. Da permisos de Eventarc Receiver
gcloud projects add-iam-policy-binding pdf-extract-41d23 \
  --member="serviceAccount:service-750080586574@gcp-sa-eventarc.iam.gserviceaccount.com" \
  --role="roles/eventarc.eventReceiver"

# 3. Espera 30 segundos para que los permisos se propaguen
sleep 30

# 4. Vuelve a desplegar
cd functions
firebase deploy --only functions:processDocument
```

## O desde la consola:

1. Abre: https://console.cloud.google.com/iam-admin/iam?project=pdf-extract-41d23
2. Click "GRANT ACCESS"
3. Agrega: `service-750080586574@gcp-sa-eventarc.iam.gserviceaccount.com`
4. Roles: "Storage Admin" + "Eventarc Event Receiver"
5. Click "SAVE"
6. Espera 1 minuto
7. Ejecuta: `firebase deploy --only functions:processDocument`

## ✅ Estado Actual

- ✅ **chatWithDocument** - DESPLEGADA
  - URL: https://us-central1-pdf-extract-41d23.cloudfunctions.net/chatWithDocument
- ❌ **processDocument** - Pendiente de permisos
