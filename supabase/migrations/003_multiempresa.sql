-- ============================================================
-- PDF Technical Assistant — multiempresa (mismo modelo que CoreIT)
--
-- Roles:
--   · superadmin (tabla platform_admins): crea empresas, invita a su primer
--     admin y entra en cualquier empresa.
--   · admin de empresa (memberships.role = 'admin'): gestiona los documentos
--     y los usuarios de su empresa, el nombre, el logo y la especialidad.
--   · usuario (memberships.role = 'user'): sube y consulta los documentos de
--     su empresa. Solo borra los que subió él.
--
-- Las conversaciones son privadas: cada persona ve solo las suyas (tampoco
-- el admin ni el superadmin las leen desde la app).
--
-- Storage: los archivos nuevos van en {org_id}/{user_id}/... Los archivos
-- anteriores a esta migración conservan su ruta ({user_id}/...) y se
-- autorizan a través de la fila de user_documents que los referencia.
-- ============================================================

-- ── Empresas, superadmins y miembros ──────────────────────────
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,60}$'),
  logo_url text check (logo_url is null or logo_url ~ '^https?://'),
  -- Especialidad técnica: decide el enfoque del asistente (prompt) y los textos.
  specialty text not null default 'general'
    check (specialty in ('general', 'electrical', 'civil', 'mechanical', 'plumbing', 'architecture')),
  -- Instrucciones adicionales para el asistente (texto libre del admin).
  assistant_instructions text not null default '' check (length(assistant_instructions) <= 2000),
  created_at timestamptz not null default now()
);

create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.memberships (
  org_id uuid not null references public.organizations on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role text not null check (role in ('admin', 'user')),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index if not exists memberships_user_idx on public.memberships (user_id);

-- ── Funciones de permisos ─────────────────────────────────────
-- security definer: consultan memberships sin depender de sus propias políticas.
create or replace function public.is_superadmin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from platform_admins where user_id = auth.uid());
$$;

create or replace function public.org_role(p_org uuid)
returns text language sql stable security definer set search_path = public as $$
  select role from memberships where org_id = p_org and user_id = auth.uid();
$$;

create or replace function public.is_org_member(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_superadmin() or public.org_role(p_org) is not null;
$$;

-- coalesce: sin fila en memberships, `null = 'admin'` daría NULL (no false) y un
-- `if not is_org_admin(...)` en plpgsql no bloquearía.
create or replace function public.is_org_admin(p_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_superadmin() or coalesce(public.org_role(p_org) = 'admin', false);
$$;

-- Lista de miembros con su correo (solo para admins de esa empresa).
create or replace function public.org_members(p_org uuid)
returns table (user_id uuid, email text, role text, created_at timestamptz, last_sign_in_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not coalesce(public.is_org_admin(p_org), false) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return query
    select m.user_id, u.email::text, m.role, m.created_at, u.last_sign_in_at
    from memberships m join auth.users u on u.id = m.user_id
    where m.org_id = p_org
    order by m.created_at;
end;
$$;

-- Primer segmento de una ruta de Storage como uuid (null si no lo es).
create or replace function public.path_org_id(p_name text)
returns uuid language sql immutable set search_path = public as $$
  select case
    when split_part(p_name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then split_part(p_name, '/', 1)::uuid
  end;
$$;

-- Solo el superadmin cambia el identificador (slug) de una empresa.
create or replace function public.guard_org_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.slug is distinct from old.slug and not public.is_superadmin() then
    raise exception 'only the superadmin can change the slug' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists organizations_guard on public.organizations;
create trigger organizations_guard before update on public.organizations
  for each row execute function public.guard_org_update();

-- ── org_id en las tablas de documentos y chat ─────────────────
alter table public.user_documents add column if not exists org_id uuid references public.organizations on delete cascade;
alter table public.document_chunks add column if not exists org_id uuid references public.organizations on delete cascade;
alter table public.summaries add column if not exists org_id uuid references public.organizations on delete cascade;
alter table public.chat_sessions add column if not exists org_id uuid references public.organizations on delete cascade;
alter table public.processing_errors add column if not exists org_id uuid references public.organizations on delete cascade;

-- ── Migración de datos: cada dueño actual recibe su empresa "personal" ──
-- Se crea para todo usuario con documentos o conversaciones. Su especialidad
-- es 'electrical' para conservar el comportamiento que tenía la app.
drop table if exists pg_temp._legacy_owners;
create temporary table _legacy_owners as
  select user_id from public.user_documents
  union
  select user_id from public.chat_sessions;

insert into public.organizations (name, slug, specialty)
select left('Personal · ' || coalesce(u.email, o.user_id::text), 120),
       'personal-' || replace(o.user_id::text, '-', ''),
       'electrical'
from _legacy_owners o join auth.users u on u.id = o.user_id
on conflict (slug) do nothing;

insert into public.memberships (org_id, user_id, role)
select org.id, o.user_id, 'admin'
from _legacy_owners o
join public.organizations org on org.slug = 'personal-' || replace(o.user_id::text, '-', '')
on conflict do nothing;

drop table _legacy_owners;

update public.user_documents d set org_id = o.id
from public.organizations o
where d.org_id is null and o.slug = 'personal-' || replace(d.user_id::text, '-', '');

update public.document_chunks c set org_id = d.org_id
from public.user_documents d
where c.org_id is null and d.id = c.document_id;

update public.summaries s set org_id = d.org_id
from public.user_documents d
where s.org_id is null and d.id = s.document_id;

update public.chat_sessions s set org_id = d.org_id
from public.user_documents d
where s.org_id is null and d.id = s.document_id;

update public.processing_errors e set org_id = d.org_id
from public.user_documents d
where e.org_id is null and d.id = e.document_id;

-- Errores huérfanos (sin documento) no se pueden asignar a ninguna empresa.
delete from public.processing_errors where org_id is null;

alter table public.user_documents alter column org_id set not null;
alter table public.document_chunks alter column org_id set not null;
alter table public.summaries alter column org_id set not null;
alter table public.chat_sessions alter column org_id set not null;
alter table public.processing_errors alter column org_id set not null;

create index if not exists user_documents_org_created_idx on public.user_documents (org_id, created_at desc);
create index if not exists document_chunks_org_idx on public.document_chunks (org_id);
create index if not exists chat_sessions_user_idx on public.chat_sessions (user_id, document_id);

-- Un fragmento o resumen pertenece siempre a la empresa de su documento.
create or replace function public.check_same_org_as_document()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from user_documents d where d.id = new.document_id and d.org_id = new.org_id) then
    raise exception 'org_id does not match the document' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists document_chunks_same_org on public.document_chunks;
create trigger document_chunks_same_org before insert or update on public.document_chunks
  for each row execute function public.check_same_org_as_document();
drop trigger if exists summaries_same_org on public.summaries;
create trigger summaries_same_org before insert or update on public.summaries
  for each row execute function public.check_same_org_as_document();
drop trigger if exists chat_sessions_same_org on public.chat_sessions;
create trigger chat_sessions_same_org before insert or update on public.chat_sessions
  for each row execute function public.check_same_org_as_document();

-- ── Búsqueda semántica: solo en documentos de empresas del usuario ──
create or replace function public.match_document_chunks(
  query_embedding vector(768),
  requested_document_id uuid,
  match_threshold float default 0.45,
  match_count int default 8
)
returns table (content text, metadata jsonb, similarity float)
language sql stable security invoker
set search_path = public
as $$
  select
    chunks.content,
    chunks.metadata,
    1 - (chunks.embedding <=> query_embedding) as similarity
  from public.document_chunks as chunks
  where chunks.document_id = requested_document_id
    and public.is_org_member(chunks.org_id)
    and 1 - (chunks.embedding <=> query_embedding) > match_threshold
  order by chunks.embedding <=> query_embedding
  limit match_count;
$$;

-- ── RLS ───────────────────────────────────────────────────────
alter table public.organizations enable row level security;
alter table public.platform_admins enable row level security;
alter table public.memberships enable row level security;

drop policy if exists org_select on public.organizations;
create policy org_select on public.organizations for select using (public.is_org_member(id));
drop policy if exists org_insert on public.organizations;
create policy org_insert on public.organizations for insert with check (public.is_superadmin());
drop policy if exists org_update on public.organizations;
create policy org_update on public.organizations for update using (public.is_org_admin(id)) with check (public.is_org_admin(id));
drop policy if exists org_delete on public.organizations;
create policy org_delete on public.organizations for delete using (public.is_superadmin());

drop policy if exists pa_select on public.platform_admins;
create policy pa_select on public.platform_admins for select using (user_id = auth.uid());
-- Alta de superadmins solo por SQL (ver docs/ENTREGA.md).

drop policy if exists mem_select on public.memberships;
create policy mem_select on public.memberships for select
  using (user_id = auth.uid() or public.is_org_admin(org_id));
-- Altas, cambios de rol y bajas: Edge Function manage-members.

-- Documentos: los ve toda la empresa; los sube cualquier miembro (en su
-- carpeta de la empresa); los borra quien los subió o un admin. El estado
-- solo lo cambian las Edge Functions (service role).
drop policy if exists "Users manage their documents" on public.user_documents;
drop policy if exists doc_select on public.user_documents;
create policy doc_select on public.user_documents for select using (public.is_org_member(org_id));
drop policy if exists doc_insert on public.user_documents;
create policy doc_insert on public.user_documents for insert with check (
  user_id = auth.uid()
  and public.is_org_member(org_id)
  and status = 'uploaded'
  and split_part(storage_path, '/', 1) = org_id::text
  and split_part(storage_path, '/', 2) = auth.uid()::text
);
drop policy if exists doc_delete on public.user_documents;
create policy doc_delete on public.user_documents for delete using (
  public.is_org_admin(org_id) or (user_id = auth.uid() and public.is_org_member(org_id))
);

drop policy if exists "Users read their chunks" on public.document_chunks;
drop policy if exists chunk_select on public.document_chunks;
create policy chunk_select on public.document_chunks for select using (public.is_org_member(org_id));

drop policy if exists "Users read their summaries" on public.summaries;
drop policy if exists summary_select on public.summaries;
create policy summary_select on public.summaries for select using (public.is_org_member(org_id));

-- Conversaciones: privadas de cada persona y solo mientras siga en la empresa.
drop policy if exists "Users manage their sessions" on public.chat_sessions;
drop policy if exists session_all on public.chat_sessions;
create policy session_all on public.chat_sessions for all
  using (user_id = auth.uid() and public.is_org_member(org_id))
  with check (user_id = auth.uid() and public.is_org_member(org_id));

drop policy if exists "Users manage their messages" on public.chat_messages;
drop policy if exists message_select on public.chat_messages;
create policy message_select on public.chat_messages for select using (
  user_id = auth.uid()
  and exists (select 1 from public.chat_sessions s where s.id = session_id and s.user_id = auth.uid() and public.is_org_member(s.org_id))
);
drop policy if exists message_insert on public.chat_messages;
create policy message_insert on public.chat_messages for insert with check (
  user_id = auth.uid()
  and exists (select 1 from public.chat_sessions s where s.id = session_id and s.user_id = auth.uid() and public.is_org_member(s.org_id))
);

drop policy if exists "Users read processing errors" on public.processing_errors;
drop policy if exists perr_select on public.processing_errors;
create policy perr_select on public.processing_errors for select
  using (public.is_org_admin(org_id) or (user_id = auth.uid() and public.is_org_member(org_id)));

-- ── Storage ───────────────────────────────────────────────────
-- Documentos: privados, solo PDF.
update storage.buckets
set file_size_limit = 52428800, allowed_mime_types = array['application/pdf']
where id = 'documents';

drop policy if exists "Users manage document files" on storage.objects;

drop policy if exists docs_obj_select on storage.objects;
create policy docs_obj_select on storage.objects for select using (
  bucket_id = 'documents' and (
    public.is_org_member(public.path_org_id(name))
    or exists (select 1 from public.user_documents d where d.storage_path = name and public.is_org_member(d.org_id))
  )
);
drop policy if exists docs_obj_insert on storage.objects;
create policy docs_obj_insert on storage.objects for insert with check (
  bucket_id = 'documents'
  and public.is_org_member(public.path_org_id(name))
  and (storage.foldername(name))[2] = auth.uid()::text
);
drop policy if exists docs_obj_delete on storage.objects;
create policy docs_obj_delete on storage.objects for delete using (
  bucket_id = 'documents' and (
    public.is_org_admin(public.path_org_id(name))
    or (public.is_org_member(public.path_org_id(name)) and (storage.foldername(name))[2] = auth.uid()::text)
    or exists (
      select 1 from public.user_documents d
      where d.storage_path = name
        and (public.is_org_admin(d.org_id) or (d.user_id = auth.uid() and public.is_org_member(d.org_id)))
    )
  )
);

-- Logos: públicos para poder mostrarlos; solo los sube el admin de la empresa.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('org-logos', 'org-logos', true, 1048576, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists logos_obj_insert on storage.objects;
create policy logos_obj_insert on storage.objects for insert with check (
  bucket_id = 'org-logos' and public.is_org_admin(public.path_org_id(name))
);
drop policy if exists logos_obj_update on storage.objects;
create policy logos_obj_update on storage.objects for update
  using (bucket_id = 'org-logos' and public.is_org_admin(public.path_org_id(name)))
  with check (bucket_id = 'org-logos' and public.is_org_admin(public.path_org_id(name)));
drop policy if exists logos_obj_select on storage.objects;
create policy logos_obj_select on storage.objects for select using (
  bucket_id = 'org-logos' and public.is_org_admin(public.path_org_id(name))
);
drop policy if exists logos_obj_delete on storage.objects;
create policy logos_obj_delete on storage.objects for delete using (
  bucket_id = 'org-logos' and public.is_org_admin(public.path_org_id(name))
);

-- ── Permisos de la API ────────────────────────────────────────
-- Las tablas nuevas no se exponen solas: se conceden de forma explícita y
-- las políticas de RLS deciden qué filas ve cada uno.
grant select, insert, update, delete on public.organizations to authenticated;
grant select on public.platform_admins to authenticated;
grant select on public.memberships to authenticated;
grant select, insert, delete on public.user_documents to authenticated;
grant select on public.document_chunks to authenticated;
grant select on public.summaries to authenticated;
grant select, insert, update, delete on public.chat_sessions to authenticated;
grant select, insert on public.chat_messages to authenticated;
grant select on public.processing_errors to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to authenticated, service_role;

revoke all on public.organizations, public.platform_admins, public.memberships, public.user_documents,
  public.document_chunks, public.summaries, public.chat_sessions, public.chat_messages,
  public.processing_errors, public.profiles from anon;

revoke execute on function public.org_members(uuid) from public, anon;
grant execute on function public.org_members(uuid) to authenticated;
revoke execute on function public.match_document_chunks(vector, uuid, float, int) from public, anon;
grant execute on function public.match_document_chunks(vector, uuid, float, int) to authenticated;
grant execute on function public.is_superadmin(), public.org_role(uuid), public.is_org_member(uuid),
  public.is_org_admin(uuid), public.path_org_id(text) to authenticated, service_role;
