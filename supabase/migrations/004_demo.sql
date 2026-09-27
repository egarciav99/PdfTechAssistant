-- ============================================================
-- PDF Technical Assistant: demo pública sin login (/demo)
-- Ejecutar una vez en Supabase → SQL Editor (después de 003). Idempotente.
--
-- Cómo funciona:
--   · Una empresa marcada con is_demo = true guarda el documento de ejemplo.
--     El superadmin entra en ella y sube el PDF desde la app, como en cualquier empresa.
--   · La Edge Function demo-chat (sin login) solo puede leer documentos de empresas demo,
--     a través de las funciones de abajo, que solo puede llamar el service role.
--   · Límite de preguntas por visitante (IP anonimizada con hash) y total por día.
-- ============================================================

alter table public.organizations add column if not exists is_demo boolean not null default false;

-- is_demo solo se cambia por SQL (SQL Editor o service role), nunca desde la app:
-- si un admin pudiera marcar su empresa como demo, sus documentos serían consultables sin login.
create or replace function public.guard_org_update()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.slug is distinct from old.slug and not public.is_superadmin() then
    raise exception 'only the superadmin can change the slug' using errcode = '42501';
  end if;
  if new.is_demo is distinct from old.is_demo and auth.uid() is not null then
    raise exception 'is_demo can only be changed with SQL' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function public.guard_org_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.is_demo and auth.uid() is not null then
    raise exception 'is_demo can only be set with SQL' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists organizations_guard_insert on public.organizations;
create trigger organizations_guard_insert before insert on public.organizations
  for each row execute function public.guard_org_insert();

-- Empresa de la demo. El superadmin puede cambiar su nombre, logo y especialidad desde la app.
insert into public.organizations (name, slug, specialty, is_demo)
values ('Demo', 'demo', 'electrical', true)
on conflict (slug) do update set is_demo = true;

-- ── Uso de la demo ─────────────────────────────────────────────
-- visitor: hash de la IP (nunca la IP). '*' guarda el total del día.
create table if not exists public.demo_usage (
  visitor text not null check (char_length(visitor) <= 128),
  day date not null default current_date,
  questions int not null default 0,
  primary key (visitor, day)
);
alter table public.demo_usage enable row level security;
-- Sin políticas: solo el service role lee y escribe.

create index if not exists demo_usage_day_idx on public.demo_usage(day);

/**
 * Descuenta una pregunta si quedan en el día, para el visitante y en total.
 * Devuelve las preguntas que le quedan al visitante, o -1 si no le quedan / -2 si se agotó el total.
 */
create or replace function public.consume_demo_question(p_visitor text, p_limit int, p_global_limit int)
returns int
language plpgsql security definer
set search_path = public
as $$
declare
  used int;
  total int;
begin
  -- Limpieza de días anteriores (la tabla solo guarda el día en curso).
  delete from public.demo_usage where day < current_date;

  insert into public.demo_usage (visitor, day, questions) values ('*', current_date, 0)
  on conflict (visitor, day) do nothing;
  select questions into total from public.demo_usage where visitor = '*' and day = current_date for update;
  if total >= p_global_limit then
    return -2;
  end if;

  insert into public.demo_usage (visitor, day, questions) values (p_visitor, current_date, 0)
  on conflict (visitor, day) do nothing;
  select questions into used from public.demo_usage where visitor = p_visitor and day = current_date for update;
  if used >= p_limit then
    return -1;
  end if;

  update public.demo_usage set questions = questions + 1 where visitor = p_visitor and day = current_date;
  update public.demo_usage set questions = questions + 1 where visitor = '*' and day = current_date;
  return p_limit - used - 1;
end;
$$;

/** Preguntas que le quedan hoy a un visitante (sin descontar). */
create or replace function public.demo_questions_left(p_visitor text, p_limit int)
returns int
language sql stable security definer
set search_path = public
as $$
  select greatest(p_limit - coalesce((select questions from public.demo_usage where visitor = p_visitor and day = current_date), 0), 0);
$$;

/**
 * Búsqueda vectorial solo para la demo: devuelve fragmentos únicamente si el documento
 * pertenece a una empresa con is_demo = true. Nunca toca documentos de otras empresas.
 */
create or replace function public.match_demo_chunks(
  query_embedding vector(768),
  requested_document_id uuid,
  match_threshold float default 0.45,
  match_count int default 8
)
returns table (content text, metadata jsonb, similarity float)
language sql stable security definer
set search_path = public
as $$
  select
    chunks.content,
    chunks.metadata,
    1 - (chunks.embedding <=> query_embedding) as similarity
  from public.document_chunks as chunks
  join public.organizations as orgs on orgs.id = chunks.org_id and orgs.is_demo
  where chunks.document_id = requested_document_id
    and 1 - (chunks.embedding <=> query_embedding) > match_threshold
  order by chunks.embedding <=> query_embedding
  limit least(match_count, 8);
$$;

revoke execute on function public.consume_demo_question(text, int, int) from public, anon, authenticated;
revoke execute on function public.demo_questions_left(text, int) from public, anon, authenticated;
revoke execute on function public.match_demo_chunks(vector, uuid, float, int) from public, anon, authenticated;
grant execute on function public.consume_demo_question(text, int, int) to service_role;
grant execute on function public.demo_questions_left(text, int) to service_role;
grant execute on function public.match_demo_chunks(vector, uuid, float, int) to service_role;
