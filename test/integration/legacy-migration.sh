#!/usr/bin/env bash
# Prueba la migración 003 con datos anteriores (por usuario):
#   1. deja la base local en la versión 002;
#   2. crea un usuario con un documento, un fragmento, un resumen y un chat;
#   3. aplica la 003 y comprueba que todo pasa a su empresa "personal" (admin).
# ¡Borra la base local! Uso: bash test/integration/legacy-migration.sh
set -euo pipefail
DB_URL="${DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
q() { psql "$DB_URL" -v ON_ERROR_STOP=1 -qtAc "$1"; }

npx supabase db reset --local --version 002 >/dev/null

q "insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
   values ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
           'legacy@example.com', '', now(), now(), now(), '{}', '{}');"
q "insert into public.user_documents (id, user_id, original_name, storage_path, status)
   values ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'viejo.pdf',
           '11111111-1111-1111-1111-111111111111/abc_viejo.pdf', 'ready');"
q "insert into public.document_chunks (document_id, user_id, content, embedding)
   values ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'texto',
           array_fill(0.01::real, array[768])::vector);"
q "insert into public.summaries (document_id, user_id, content)
   values ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', '<div>resumen</div>');"
q "insert into public.chat_sessions (id, user_id, document_id)
   values ('s1', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');"
q "insert into public.chat_messages (session_id, user_id, role, content)
   values ('s1', '11111111-1111-1111-1111-111111111111', 'user', 'hola');"
q "insert into public.processing_errors (document_id, user_id, error)
   values ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'x'), (null, '11111111-1111-1111-1111-111111111111', 'huérfano');"

npx supabase migration up --local >/dev/null

fail() { echo "FALLO: $1"; exit 1; }
org=$(q "select id from organizations where slug = 'personal-11111111111111111111111111111111'")
[ -n "$org" ] || fail "no se creó la empresa personal"
[ "$(q "select specialty from organizations where id = '$org'")" = "electrical" ] || fail "especialidad"
[ "$(q "select role from memberships where org_id = '$org' and user_id = '11111111-1111-1111-1111-111111111111'")" = "admin" ] || fail "el dueño no es admin"
for t in user_documents document_chunks summaries chat_sessions processing_errors; do
  [ "$(q "select count(*) from $t where org_id is distinct from '$org'")" = "0" ] || fail "$t sin org_id"
done
[ "$(q "select count(*) from processing_errors")" = "1" ] || fail "errores huérfanos"
[ "$(q "select count(*) from chat_messages")" = "1" ] || fail "se perdieron mensajes"

# El dueño sigue viendo su documento y su chat con RLS.
as_user="set local role authenticated; set local request.jwt.claims = '{\"sub\":\"11111111-1111-1111-1111-111111111111\",\"role\":\"authenticated\"}';"
[ "$(psql "$DB_URL" -qtAc "begin; $as_user select count(*) from user_documents; commit;" | grep -E '^[0-9]+$')" = "1" ] || fail "RLS documento"
[ "$(psql "$DB_URL" -qtAc "begin; $as_user select count(*) from chat_messages; commit;" | grep -E '^[0-9]+$')" = "1" ] || fail "RLS chat"

echo "OK: migración de datos existentes a empresas personales"
npx supabase db reset --local >/dev/null
