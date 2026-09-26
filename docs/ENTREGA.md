# PDF Technical Assistant — cómo se entrega a una empresa

PDF Technical Assistant es un asistente para documentación técnica. La empresa sube sus PDF (especificaciones, memorias, catálogos...). La app los resume y responde preguntas citando solo lo que dicen los documentos. Cada empresa tiene su **especialidad** (eléctrica, civil, mecánica, hidrosanitaria, arquitectura o general), que decide en qué se centra el asistente, además de su **nombre** y su **logo**.

La interfaz funciona en **español e inglés**:
- el idioma se detecta del navegador y se cambia con el selector;
- las respuestas y los resúmenes salen en el idioma de la interfaz.

## Piezas

```
Navegador (React)  ──►  Supabase (login, empresas, roles, Storage, pgvector)
                             │
                             ├─► Edge Function process-document ──► Gemini (embeddings + resumen)
                             ├─► Edge Function chat-with-document ──► Gemini (respuesta)
                             └─► Edge Function manage-members (invitaciones y roles)
```

- **Web (React):** archivos estáticos. Se sirven desde Vercel, Nginx o Docker.
- **Supabase:**
  - Auth: solo por invitación;
  - Postgres con RLS por empresa;
  - Storage: bucket privado `documents` en `{org_id}/{user_id}/...` y bucket público `org-logos`;
  - pgvector para la búsqueda en los documentos;
  - las tres Edge Functions.
- **Gemini:** solo lo llaman las Edge Functions. La clave nunca llega al navegador.
- **Privacidad:** antes de indexar un PDF o enviarlo al modelo se anonimizan los datos personales (correos, teléfonos, RFC, direcciones, importes, nombres etiquetados). Lo hace `supabase/functions/_shared/redaction.ts`.

## Roles

| Rol | Qué puede hacer |
|---|---|
| **Superadmin** (tú) | Crear empresas (nombre, identificador y especialidad) e invitar a su primer admin. Entrar en cualquier empresa. |
| **Admin de empresa** (su IT) | Subir y borrar cualquier documento de su empresa. Invitar usuarios, cambiar roles y quitar personas. Editar el nombre, el logo, la especialidad y las indicaciones del asistente. |
| **Usuario** | Ver todos los documentos de su empresa, sus resúmenes y preguntarles. Subir documentos y borrar solo los que subió él. |

- **Conversaciones privadas:** cada persona ve solo las suyas. Ni el admin ni el superadmin las leen desde la app.
- **Aislamiento:** nadie ve datos de otra empresa (tablas, archivos, búsqueda y funciones).
- **Registro:** solo se entra por invitación; el registro libre está desactivado.
- **Admins:** una empresa nunca se queda sin admin.

---

## Opción A · SaaS (tú lo alojas)

Una sola instalación para todas las empresas. Cada empresa ve solo lo suyo.

### 1. Supabase
1. Crea un proyecto en [supabase.com](https://supabase.com).
2. Aplica la base de datos:
   ```bash
   npx supabase link --project-ref <ref>
   npx supabase db push
   ```
   También puedes pegar los archivos de `supabase/migrations/`, en orden, en el **SQL Editor**.
3. Despliega las funciones y sus secretos:
   ```bash
   npx supabase functions deploy process-document
   npx supabase functions deploy chat-with-document
   npx supabase functions deploy manage-members
   npx supabase secrets set GEMINI_API_KEY=<clave> \
     PDF_APP_URL=https://tu-dominio \
     PDF_ALLOWED_ORIGINS=https://tu-dominio
   ```
   - `PDF_APP_URL` es la dirección a la que llevan los correos de invitación.
   - `PDF_ALLOWED_ORIGINS` es la lista (separada por comas) de orígenes que pueden llamar a las funciones.
4. Ajustes de **Authentication**:
   - **Sign In / Providers:** desactiva *Allow new users to sign up* y deja el proveedor **Email** activo. Es el equivalente a `enable_signup = false` en `[auth]` de `supabase/config.toml`. No desactives el registro dentro de *Email*, porque también bloquea el inicio de sesión por correo.
   - **URL Configuration:** en *Site URL* pon la URL de la app y añádela también a *Redirect URLs*.
   - **SMTP propio** (Settings → Auth → SMTP): el correo por defecto de Supabase tiene un límite muy bajo y las invitaciones no llegarían bien.
5. Hazte superadmin:
   1. Crea tu usuario en **Authentication → Users → Add user**.
   2. Ejecuta en el SQL Editor:
      ```sql
      insert into platform_admins (user_id)
      select id from auth.users where email = 'tu-correo@dominio.com';
      ```

### 2. Web en Vercel (u otro hosting estático)
Importa el repo y añade estas variables:

| Variable | Valor |
|---|---|
| `VITE_SUPABASE_URL` | URL del proyecto de Supabase |
| `VITE_SUPABASE_ANON_KEY` | Clave pública (*anon* / *publishable*) |
| `VITE_DEFAULT_LANGUAGE` | Opcional: `es` (predeterminado) o `en` |

Sin Supabase configurado, la web muestra una pantalla de "Falta la configuración". **No hay modo demo.**

### 3. Dar de alta una empresa
1. Entra como superadmin y abre **Empresas**. Indica:
   - el nombre;
   - el identificador (se rellena solo);
   - el correo de su admin (IT);
   - la especialidad.

   El admin recibirá la invitación.
2. El admin entra con el enlace y crea su contraseña. En **Usuarios** puede:
   - subir el logo;
   - ajustar la especialidad;
   - añadir indicaciones al asistente (normas, unidades, formato);
   - invitar a las personas que van a consultar los documentos.
3. Los documentos se suben con **+ Subir**. Se procesan al momento: el estado pasa de *Procesando* a *Listo*.

---

## Opción B · Instalación en la empresa (confidencialidad)

Para empresas que no pueden sacar sus documentos de su red. Se usa el mismo código.

1. **Supabase propio:** puede ser un proyecto suyo en Supabase Cloud o Supabase autoalojado con Docker ([guía oficial](https://supabase.com/docs/guides/self-hosting/docker)). Aplica las migraciones y las funciones igual que en la opción A.
   - En una instalación de una sola empresa, crea esa empresa desde el panel de superadmin y deja al IT de la empresa como admin.
   - Las funciones necesitan salida a la API de Gemini (`generativelanguage.googleapis.com`). Si su red usa un proxy, `GEMINI_API_BASE` permite apuntar a una pasarela interna compatible.
2. **Web con Docker:**
   ```bash
   docker build -t pdf-assistant .
   docker run -d -p 8080:80 \
     -e SUPABASE_URL=https://supabase.empresa.local \
     -e SUPABASE_ANON_KEY=<clave pública> \
     -e COMPANY_NAME="Nombre de la empresa" \
     -e LOGO_URL=https://intranet.empresa.local/logo.png \
     -e DEFAULT_LANGUAGE=es \
     pdf-assistant
   ```
   El contenedor genera `config.json` a partir de esas variables (script `deploy/write-config.sh`). `COMPANY_NAME` y `LOGO_URL` son la marca de la pantalla de acceso. Dentro de la app se usan el nombre y el logo que guarda la empresa.

   Otra opción es compilar con `npm run build` y copiar la carpeta `dist/` a cualquier servidor web (IIS, Apache, Nginx). En ese caso se edita `dist/config.json` y no hace falta recompilar. Con un servidor distinto de Nginx, redirige las rutas desconocidas a `index.html`.

### `config.json`

```json
{
  "companyName": "",
  "logoUrl": "",
  "defaultLanguage": "es",
  "supabase": { "url": "", "anonKey": "" }
}
```

- Lo que falte o venga vacío se toma de las variables `VITE_*` del build.
- `defaultLanguage` se usa cuando el navegador no está en español ni en inglés y la persona todavía no ha elegido idioma.
- Sin `supabase.url` y `anonKey` la app no arranca (no hay modo demo).

---

## Datos existentes (migración a multiempresa)

La migración `003_multiempresa.sql`:
- crea una empresa **personal** para cada usuario que ya tenía documentos o conversaciones, con él como admin y especialidad eléctrica (el comportamiento que tenía la app);
- asigna a esa empresa sus documentos, fragmentos, resúmenes, chats y errores.

Los archivos antiguos se quedan en su ruta (`{user_id}/...`). Siguen siendo accesibles para los miembros de su empresa a través del documento que los referencia; los nuevos se guardan en `{org_id}/{user_id}/...`.

Después, el superadmin puede, por ejemplo:
- renombrar esas empresas;
- invitar a más personas.

## Pruebas (Supabase local)

Requisitos: Docker y Node 22.

```bash
npm ci
npx supabase start                                   # Postgres, Auth, Storage, Mailpit...
node test/e2e/gemini-mock.mjs &                      # simulador de Gemini (sin clave real)
npx supabase functions serve --env-file test/e2e/functions.env &

npm test -- --run           # unitarias (incluye que es/en tengan las mismas claves)
npm run test:integration    # RLS, Storage y Edge Functions: la empresa A no ve nada de la B
npm run test:e2e            # Chromium: superadmin → empresa → admin sube PDF → invita → el usuario pregunta (es y en)
npm run test:migration      # migración de datos existentes (¡reinicia la base local!)
```

- El simulador de Gemini devuelve embeddings constantes y respuestas que citan el fragmento recuperado. Así las pruebas no dependen de la API real y se puede comprobar que al modelo le llegan los datos anonimizados.
- Si tu red intercepta TLS (proxy corporativo) y las funciones no pueden descargar sus dependencias de npm, crea `supabase/functions/.npmrc` con un registro accesible (`registry=...`). El archivo está en `.gitignore`.

## Checklist antes de dar acceso a una empresa
- [ ] Registro libre desactivado en Supabase (y login por email activo).
- [ ] SMTP propio configurado; prueba una invitación.
- [ ] `PDF_APP_URL` y `PDF_ALLOWED_ORIGINS` con el dominio real.
- [ ] `GEMINI_API_KEY` como secreto de las funciones (nunca en el frontend).
- [ ] Empresa creada con la especialidad correcta y su admin invitado.
- [ ] Contrato de encargado del tratamiento con la empresa (opción A), porque sus documentos pasan por tu infraestructura y por Gemini.
