# Supabase

Aplica la migración y despliega las funciones desde la raíz:

```bash
npx supabase login
npx supabase link --project-ref <PROJECT_REF>
npx supabase db push
npx supabase secrets set GEMINI_API_KEY=<GEMINI_KEY>
npx supabase functions deploy process-document
npx supabase functions deploy chat-with-document
```

Configura en el dashboard de Supabase el proveedor Email de Auth y verifica que el bucket privado `documents` exista. El frontend usa `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`; nunca expongas `SUPABASE_SERVICE_ROLE_KEY`.
