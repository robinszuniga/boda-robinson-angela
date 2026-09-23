-- Archivo generado con "npm run db:bundle". No lo edites a mano:
-- cambia supabase/migrations/*.sql y vuelve a generarlo.
-- Pégalo completo en Supabase → SQL Editor → Run.

begin;

-- >>> 0001_schema.sql
-- =============================================================
-- 0001 · Esquema principal de la app de boda
-- =============================================================

create type public.vendor_status as enum ('cotizando', 'reservado', 'pagado', 'descartado');
create type public.guest_group_kind as enum ('familia_novio', 'familia_novia', 'amigos', 'trabajo', 'otros');
create type public.rsvp_status as enum ('pendiente', 'confirmado', 'rechazado');
create type public.link_kind as enum ('juntos', 'separados');
create type public.task_assignee as enum ('novio', 'novia', 'ambos');
create type public.task_status as enum ('por_hacer', 'en_proceso', 'listo');
create type public.task_priority as enum ('alta', 'media', 'baja');
create type public.document_category as enum ('contrato', 'cotizacion', 'factura', 'inspiracion', 'otro');
create type public.gift_kind as enum ('articulo', 'efectivo');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Lista de usuarios autorizados (los novios). Se llena a mano en setup.sql.
create table public.app_users (
  email text primary key check (email = lower(email)),
  display_name text not null
);

-- Configuración general (una sola fila)
create table public.wedding_settings (
  id smallint primary key default 1 check (id = 1),
  partner_1_name text not null default 'Robinson',
  partner_2_name text not null default 'Ángela',
  wedding_date timestamptz not null default '2027-05-15 16:00:00-05',
  venue_name text,
  venue_address text,
  venue_capacity integer not null default 150 check (venue_capacity >= 0),
  total_budget numeric(14, 2) not null default 0 check (total_budget >= 0),
  rsvp_deadline date,
  guest_message text,
  updated_at timestamptz not null default now()
);

create trigger wedding_settings_updated_at before update on public.wedding_settings
  for each row execute function public.set_updated_at();

-- Presupuesto
create table public.budget_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 80),
  estimated numeric(14, 2) not null default 0 check (estimated >= 0),
  color text not null default '#7d8f69',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- Proveedores (también son las opciones del comparador)
create table public.vendors (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.budget_categories (id) on delete set null,
  name text not null check (length(trim(name)) between 1 and 120),
  contact_name text,
  phone text,
  email text,
  instagram text,
  website text,
  portfolio_url text,
  quoted_cost numeric(14, 2) check (quoted_cost >= 0),
  final_cost numeric(14, 2) check (final_cost >= 0),
  status public.vendor_status not null default 'cotizando',
  includes text,
  availability text,
  pros text,
  cons text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index vendors_category_idx on public.vendors (category_id);
create trigger vendors_updated_at before update on public.vendors
  for each row execute function public.set_updated_at();

-- Pagos: abonos hechos (is_paid) y pagos programados
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.budget_categories (id) on delete restrict,
  vendor_id uuid references public.vendors (id) on delete set null,
  amount numeric(14, 2) not null check (amount > 0),
  date date not null default current_date,
  is_paid boolean not null default true,
  note text,
  created_at timestamptz not null default now()
);
create index payments_category_idx on public.payments (category_id);
create index payments_vendor_idx on public.payments (vendor_id);

-- Mesas e invitados
create table public.seating_tables (
  id uuid primary key default gen_random_uuid(),
  number integer not null unique check (number > 0),
  name text,
  capacity integer not null default 10 check (capacity between 1 and 50),
  created_at timestamptz not null default now()
);

create table public.guests (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 120),
  guest_group public.guest_group_kind not null default 'amigos',
  phone text,
  email text,
  plus_ones_allowed smallint not null default 0 check (plus_ones_allowed between 0 and 10),
  plus_ones_confirmed smallint not null default 0 check (plus_ones_confirmed >= 0),
  rsvp_status public.rsvp_status not null default 'pendiente',
  dietary text,
  table_id uuid references public.seating_tables (id) on delete set null,
  rsvp_token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  rsvp_responded_at timestamptz,
  guest_message text,
  thank_you_sent_at timestamptz,
  thank_you_method text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint plus_ones_within_allowed check (plus_ones_confirmed <= plus_ones_allowed)
);
create index guests_table_idx on public.guests (table_id);
create trigger guests_updated_at before update on public.guests
  for each row execute function public.set_updated_at();

-- Vínculos de cercanía entre invitados (sentar juntos / separados)
create table public.guest_links (
  id uuid primary key default gen_random_uuid(),
  guest_a uuid not null references public.guests (id) on delete cascade,
  guest_b uuid not null references public.guests (id) on delete cascade,
  kind public.link_kind not null default 'juntos',
  note text,
  created_at timestamptz not null default now(),
  constraint guest_links_distinct check (guest_a <> guest_b)
);
create unique index guest_links_pair_idx
  on public.guest_links (least(guest_a, guest_b), greatest(guest_a, guest_b));

-- Tareas (checklist previo)
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 1 and 200),
  description text,
  due_date date,
  assignee public.task_assignee not null default 'ambos',
  status public.task_status not null default 'por_hacer',
  priority public.task_priority not null default 'media',
  stage text,
  template_key text unique,
  template_offset_days integer,
  sort_order integer not null default 0,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger tasks_updated_at before update on public.tasks
  for each row execute function public.set_updated_at();

-- Cronograma del día de la boda
create table public.day_schedule_items (
  id uuid primary key default gen_random_uuid(),
  start_time time not null,
  end_time time,
  title text not null check (length(trim(title)) between 1 and 200),
  description text,
  location text,
  vendor_id uuid references public.vendors (id) on delete set null,
  responsible text,
  created_at timestamptz not null default now()
);

-- Documentos (también adjuntos de proveedores)
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 200),
  category public.document_category not null default 'otro',
  vendor_id uuid references public.vendors (id) on delete set null,
  storage_path text not null unique,
  mime_type text,
  size_bytes bigint,
  notes text,
  uploaded_at timestamptz not null default now()
);
create index documents_vendor_idx on public.documents (vendor_id);

-- Mesa de regalos
create table public.gifts (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 160),
  description text,
  kind public.gift_kind not null default 'articulo',
  store_url text,
  price numeric(14, 2) check (price >= 0),
  bank_details text,
  quantity smallint not null default 1 check (quantity between 1 and 99),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.gift_claims (
  id uuid primary key default gen_random_uuid(),
  gift_id uuid not null references public.gifts (id) on delete cascade,
  guest_id uuid not null references public.guests (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint gift_claims_unique unique (gift_id, guest_id)
);

create table public.gifts_received (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid references public.guests (id) on delete set null,
  from_name text,
  description text not null check (length(trim(description)) between 1 and 300),
  gift_id uuid references public.gifts (id) on delete set null,
  received_on date not null default current_date,
  notes text,
  -- Solo para regalos de personas que no están en la lista de invitados;
  -- para los invitados el agradecimiento se marca en guests.thank_you_sent_at
  thank_you_sent_at timestamptz,
  created_at timestamptz not null default now(),
  constraint gifts_received_from check (guest_id is not null or from_name is not null)
);
create index gifts_received_guest_idx on public.gifts_received (guest_id);

-- -------------------------------------------------------------
-- Datos iniciales
-- -------------------------------------------------------------
insert into public.wedding_settings (id) values (1);

insert into public.budget_categories (name, color, sort_order) values
  ('Lugar (venue)',           '#7d8f69', 1),
  ('Catering',                '#c07a5a', 2),
  ('Fotografía y video',      '#6b7fa3', 3),
  ('Vestido y traje',         '#b5838d', 4),
  ('Decoración y flores',     '#9c8a4a', 5),
  ('Música',                  '#5f8f8b', 6),
  ('Transporte',              '#8a7560', 7),
  ('Invitaciones',            '#a36b8f', 8),
  ('Luna de miel',            '#4f7a9a', 9),
  ('Otros',                   '#8c8c84', 10);

-- >>> 0002_rls.sql
-- =============================================================
-- 0002 · Seguridad: solo los novios (app_users) ven y editan datos
-- =============================================================

create or replace function public.is_couple()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.app_users
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

revoke all on function public.is_couple() from public, anon;
grant execute on function public.is_couple() to authenticated;

-- El rol anónimo no toca tablas: el RSVP público usa funciones (0003).
revoke all on all tables in schema public from anon;

alter table public.app_users enable row level security;
create policy app_users_read on public.app_users
  for select to authenticated
  using ((select public.is_couple()));

do $$
declare
  t text;
begin
  foreach t in array array[
    'wedding_settings', 'budget_categories', 'vendors', 'payments',
    'seating_tables', 'guests', 'guest_links', 'tasks', 'day_schedule_items',
    'documents', 'gifts', 'gift_claims', 'gifts_received'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy couple_all on public.%I for all to authenticated '
      'using ((select public.is_couple())) with check ((select public.is_couple()))',
      t
    );
  end loop;
end;
$$;

-- La configuración es una fila fija: no se crea ni se borra desde la app.
revoke insert, delete on public.wedding_settings from authenticated;

-- >>> 0003_rsvp_public.sql
-- =============================================================
-- 0003 · RSVP público (sin login)
-- El invitado solo conoce su token. Estas funciones son la única
-- puerta para el rol anónimo y exponen solo los datos de ese invitado.
-- =============================================================

create or replace function public.rsvp_get(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_guest public.guests;
  v_settings public.wedding_settings;
begin
  if p_token is null or length(p_token) < 16 or length(p_token) > 64 then
    return null;
  end if;

  select * into v_guest from public.guests where rsvp_token = p_token;
  if not found then
    return null;
  end if;

  select * into v_settings from public.wedding_settings where id = 1;

  return jsonb_build_object(
    'guest', jsonb_build_object(
      'name', v_guest.name,
      'plus_ones_allowed', v_guest.plus_ones_allowed,
      'plus_ones_confirmed', v_guest.plus_ones_confirmed,
      'rsvp_status', v_guest.rsvp_status,
      'dietary', v_guest.dietary,
      'guest_message', v_guest.guest_message,
      'responded_at', v_guest.rsvp_responded_at
    ),
    'wedding', jsonb_build_object(
      'partner_1_name', v_settings.partner_1_name,
      'partner_2_name', v_settings.partner_2_name,
      'wedding_date', v_settings.wedding_date,
      'venue_name', v_settings.venue_name,
      'venue_address', v_settings.venue_address,
      'rsvp_deadline', v_settings.rsvp_deadline,
      'guest_message', v_settings.guest_message
    ),
    'gifts', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', g.id,
          'name', g.name,
          'description', g.description,
          'kind', g.kind,
          'store_url', g.store_url,
          'price', g.price,
          'bank_details', g.bank_details,
          'remaining', case
            when g.kind = 'efectivo' then null
            else greatest(g.quantity - (select count(*) from public.gift_claims c where c.gift_id = g.id), 0)
          end,
          'claimed_by_me', exists (
            select 1 from public.gift_claims c where c.gift_id = g.id and c.guest_id = v_guest.id
          )
        )
        order by g.sort_order, g.created_at
      )
      from public.gifts g
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.rsvp_submit(
  p_token text,
  p_status text,
  p_plus_ones integer,
  p_dietary text,
  p_message text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_guest public.guests;
  v_deadline date;
begin
  select * into v_guest from public.guests where rsvp_token = p_token for update;
  if not found then
    raise exception 'invalid_token';
  end if;

  if p_status is null or p_status not in ('confirmado', 'rechazado') then
    raise exception 'invalid_status';
  end if;

  select rsvp_deadline into v_deadline from public.wedding_settings where id = 1;
  if v_deadline is not null and (now() at time zone 'America/Bogota')::date > v_deadline then
    raise exception 'deadline_passed';
  end if;

  if p_status = 'confirmado'
     and (p_plus_ones is null or p_plus_ones < 0 or p_plus_ones > v_guest.plus_ones_allowed) then
    raise exception 'invalid_plus_ones';
  end if;

  if length(coalesce(p_dietary, '')) > 500 or length(coalesce(p_message, '')) > 1000 then
    raise exception 'text_too_long';
  end if;

  update public.guests
  set rsvp_status = p_status::public.rsvp_status,
      plus_ones_confirmed = case when p_status = 'confirmado' then p_plus_ones else 0 end,
      dietary = nullif(trim(p_dietary), ''),
      guest_message = nullif(trim(p_message), ''),
      rsvp_responded_at = now()
  where id = v_guest.id;

  return public.rsvp_get(p_token);
end;
$$;

create or replace function public.rsvp_claim_gift(p_token text, p_gift_id uuid, p_claim boolean)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_guest_id uuid;
  v_gift public.gifts;
  v_taken integer;
begin
  select id into v_guest_id from public.guests where rsvp_token = p_token;
  if v_guest_id is null then
    raise exception 'invalid_token';
  end if;

  -- Bloquea la fila del regalo para que dos invitados no aparten el último cupo a la vez
  select * into v_gift from public.gifts where id = p_gift_id for update;
  if not found then
    raise exception 'invalid_gift';
  end if;

  if p_claim then
    if not exists (
      select 1 from public.gift_claims where gift_id = p_gift_id and guest_id = v_guest_id
    ) then
      if v_gift.kind = 'articulo' then
        select count(*) into v_taken from public.gift_claims where gift_id = p_gift_id;
        if v_taken >= v_gift.quantity then
          raise exception 'gift_unavailable';
        end if;
      end if;
      insert into public.gift_claims (gift_id, guest_id) values (p_gift_id, v_guest_id);
    end if;
  else
    delete from public.gift_claims where gift_id = p_gift_id and guest_id = v_guest_id;
  end if;

  return public.rsvp_get(p_token);
end;
$$;

revoke all on function public.rsvp_get(text) from public;
revoke all on function public.rsvp_submit(text, text, integer, text, text) from public;
revoke all on function public.rsvp_claim_gift(text, uuid, boolean) from public;
grant execute on function public.rsvp_get(text) to anon, authenticated;
grant execute on function public.rsvp_submit(text, text, integer, text, text) to anon, authenticated;
grant execute on function public.rsvp_claim_gift(text, uuid, boolean) to anon, authenticated;

-- >>> 0004_storage.sql
-- =============================================================
-- 0004 · Storage: bucket privado para contratos, cotizaciones e inspiración
-- =============================================================

insert into storage.buckets (id, name, public, file_size_limit)
values ('documentos', 'documentos', false, 20971520)
on conflict (id) do nothing;

create policy documentos_select on storage.objects
  for select to authenticated
  using (bucket_id = 'documentos' and (select public.is_couple()));

create policy documentos_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'documentos' and (select public.is_couple()));

create policy documentos_update on storage.objects
  for update to authenticated
  using (bucket_id = 'documentos' and (select public.is_couple()))
  with check (bucket_id = 'documentos' and (select public.is_couple()));

create policy documentos_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'documentos' and (select public.is_couple()));

-- >>> 0005_guest_experience.sql
-- =============================================================
-- 0005 · Experiencia del invitado, lluvia de sobres, acompañantes
--        con nombre y función para mantener activo el proyecto
-- =============================================================

-- Información extra para la página del invitado
alter table public.wedding_settings
  add column dress_code text,
  add column logistics_info text,
  add column lodging_info text,
  add column faq text,
  add column livestream_url text,
  add column photo_album_url text,
  add column show_table_to_guests boolean not null default false,
  add column envelope_rain boolean not null default false,
  add column ask_song boolean not null default true,
  add column offer_transport boolean not null default false;

alter table public.guests
  add column song_request text,
  add column needs_transport boolean not null default false,
  add column rsvp_reminded_at timestamptz;

-- Monto de sobres o aportes en efectivo (privado, solo lo ven los novios)
alter table public.gifts_received
  add column amount numeric(14, 2) check (amount >= 0);

-- Acompañantes con nombre dentro de una invitación (grupo familiar)
create table public.guest_members (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid not null references public.guests (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  attending boolean,
  dietary text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index guest_members_guest_idx on public.guest_members (guest_id);

alter table public.guest_members enable row level security;
create policy couple_all on public.guest_members
  for all to authenticated
  using ((select public.is_couple())) with check ((select public.is_couple()));
revoke all on public.guest_members from anon;

-- -------------------------------------------------------------
-- RSVP público actualizado
-- -------------------------------------------------------------
create or replace function public.rsvp_get(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_guest public.guests;
  v_settings public.wedding_settings;
  v_table jsonb;
begin
  if p_token is null or length(p_token) < 16 or length(p_token) > 64 then
    return null;
  end if;

  select * into v_guest from public.guests where rsvp_token = p_token;
  if not found then
    return null;
  end if;

  select * into v_settings from public.wedding_settings where id = 1;

  -- La mesa solo se muestra si los novios lo activaron y el invitado confirmó
  if v_settings.show_table_to_guests and v_guest.rsvp_status = 'confirmado' and v_guest.table_id is not null then
    select jsonb_build_object('number', t.number, 'name', t.name)
    into v_table
    from public.seating_tables t
    where t.id = v_guest.table_id;
  end if;

  return jsonb_build_object(
    'guest', jsonb_build_object(
      'name', v_guest.name,
      'plus_ones_allowed', v_guest.plus_ones_allowed,
      'plus_ones_confirmed', v_guest.plus_ones_confirmed,
      'rsvp_status', v_guest.rsvp_status,
      'dietary', v_guest.dietary,
      'guest_message', v_guest.guest_message,
      'song_request', v_guest.song_request,
      'needs_transport', v_guest.needs_transport,
      'responded_at', v_guest.rsvp_responded_at,
      'table', v_table,
      'members', coalesce((
        select jsonb_agg(
          jsonb_build_object('id', m.id, 'name', m.name, 'attending', m.attending, 'dietary', m.dietary)
          order by m.sort_order, m.created_at
        )
        from public.guest_members m
        where m.guest_id = v_guest.id
      ), '[]'::jsonb)
    ),
    'wedding', jsonb_build_object(
      'partner_1_name', v_settings.partner_1_name,
      'partner_2_name', v_settings.partner_2_name,
      'wedding_date', v_settings.wedding_date,
      'venue_name', v_settings.venue_name,
      'venue_address', v_settings.venue_address,
      'rsvp_deadline', v_settings.rsvp_deadline,
      'guest_message', v_settings.guest_message,
      'dress_code', v_settings.dress_code,
      'logistics_info', v_settings.logistics_info,
      'lodging_info', v_settings.lodging_info,
      'faq', v_settings.faq,
      'livestream_url', v_settings.livestream_url,
      'photo_album_url', v_settings.photo_album_url,
      'envelope_rain', v_settings.envelope_rain,
      'ask_song', v_settings.ask_song,
      'offer_transport', v_settings.offer_transport
    ),
    'gifts', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', g.id,
          'name', g.name,
          'description', g.description,
          'kind', g.kind,
          'store_url', g.store_url,
          'price', g.price,
          'bank_details', g.bank_details,
          'remaining', case
            when g.kind = 'efectivo' then null
            else greatest(g.quantity - (select count(*) from public.gift_claims c where c.gift_id = g.id), 0)
          end,
          'claimed_by_me', exists (
            select 1 from public.gift_claims c where c.gift_id = g.id and c.guest_id = v_guest.id
          )
        )
        order by g.sort_order, g.created_at
      )
      from public.gifts g
    ), '[]'::jsonb)
  );
end;
$$;

drop function if exists public.rsvp_submit(text, text, integer, text, text);

create or replace function public.rsvp_submit(
  p_token text,
  p_status text,
  p_plus_ones integer,
  p_dietary text,
  p_message text,
  p_song text default null,
  p_needs_transport boolean default false,
  p_members jsonb default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_guest public.guests;
  v_deadline date;
  v_member_count integer;
  v_plus_ones integer := p_plus_ones;
  v_item jsonb;
begin
  select * into v_guest from public.guests where rsvp_token = p_token for update;
  if not found then
    raise exception 'invalid_token';
  end if;

  if p_status is null or p_status not in ('confirmado', 'rechazado') then
    raise exception 'invalid_status';
  end if;

  select rsvp_deadline into v_deadline from public.wedding_settings where id = 1;
  if v_deadline is not null and (now() at time zone 'America/Bogota')::date > v_deadline then
    raise exception 'deadline_passed';
  end if;

  if length(coalesce(p_dietary, '')) > 500
     or length(coalesce(p_message, '')) > 1000
     or length(coalesce(p_song, '')) > 200 then
    raise exception 'text_too_long';
  end if;

  select count(*) into v_member_count from public.guest_members where guest_id = v_guest.id;

  if v_member_count > 0 then
    -- Con acompañantes con nombre, los que vienen se marcan uno por uno
    if p_members is not null and jsonb_typeof(p_members) = 'array' then
      for v_item in select * from jsonb_array_elements(p_members)
      loop
        if length(coalesce(v_item ->> 'dietary', '')) > 200 then
          raise exception 'text_too_long';
        end if;
        update public.guest_members
        set attending = case when p_status = 'confirmado' then coalesce((v_item ->> 'attending')::boolean, false) else false end,
            dietary = nullif(trim(v_item ->> 'dietary'), '')
        where id = (v_item ->> 'id')::uuid
          and guest_id = v_guest.id;
      end loop;
    end if;
    if p_status = 'rechazado' then
      update public.guest_members set attending = false where guest_id = v_guest.id;
    end if;
    select count(*) into v_plus_ones
    from public.guest_members
    where guest_id = v_guest.id and attending;
  end if;

  if p_status = 'confirmado'
     and (v_plus_ones is null or v_plus_ones < 0 or v_plus_ones > v_guest.plus_ones_allowed) then
    raise exception 'invalid_plus_ones';
  end if;

  update public.guests
  set rsvp_status = p_status::public.rsvp_status,
      plus_ones_confirmed = case when p_status = 'confirmado' then v_plus_ones else 0 end,
      dietary = nullif(trim(p_dietary), ''),
      guest_message = nullif(trim(p_message), ''),
      song_request = nullif(trim(p_song), ''),
      needs_transport = case when p_status = 'confirmado' then coalesce(p_needs_transport, false) else false end,
      rsvp_responded_at = now()
  where id = v_guest.id;

  return public.rsvp_get(p_token);
end;
$$;

revoke all on function public.rsvp_submit(text, text, integer, text, text, text, boolean, jsonb) from public;
grant execute on function public.rsvp_submit(text, text, integer, text, text, text, boolean, jsonb) to anon, authenticated;

-- -------------------------------------------------------------
-- Keep-alive: el plan gratis de Supabase pausa proyectos con poca
-- actividad durante 7 días. Una tarea diaria llama a esta función.
-- -------------------------------------------------------------
create or replace function public.keep_alive()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from public.wedding_settings;
$$;

revoke all on function public.keep_alive() from public;
grant execute on function public.keep_alive() to anon, authenticated;

-- >>> 0006_checklist.sql
-- =============================================================
-- 0006 · Ideas de la lista de chequeo: edad de los invitados,
--        notas para el coordinador del día y más categorías
-- =============================================================

-- Niños (menú infantil y conteo para el catering) y adultos mayores
-- (sentarlos cerca de baños y salida). Los acompañantes sin nombre
-- cuentan como adultos.
create type public.age_group as enum ('adulto', 'nino', 'mayor');

alter table public.guests
  add column age_group public.age_group not null default 'adulto';

alter table public.guest_members
  add column age_group public.age_group not null default 'adulto';

-- Personas clave e instrucciones para la hoja del coordinador
alter table public.wedding_settings
  add column coordinator_notes text check (length(coordinator_notes) <= 4000);

-- Categorías de presupuesto que faltaban (no se duplican si ya existen)
with base as (
  select coalesce(max(sort_order), 0) as m
  from public.budget_categories
  where name <> 'Otros'
)
insert into public.budget_categories (name, color, sort_order)
select v.name, v.color, base.m + v.n
from base,
  (values
    (1, 'Ceremonia y trámites', '#6d6aa8'),
    (2, 'Argollas y joyas', '#c9a227'),
    (3, 'Belleza', '#d4879c'),
    (4, 'Recuerdos y detalles', '#5b9a6e')
  ) as v (n, name, color)
where not exists (
  select 1 from public.budget_categories c where lower(c.name) = lower(v.name)
);

-- "Otros" sigue de última
update public.budget_categories
set sort_order = (select max(sort_order) from public.budget_categories) + 1
where name = 'Otros'
  and sort_order < (select max(sort_order) from public.budget_categories);

-- >>> 0007_invitaciones.sql
-- =============================================================
-- 0007 · Envío de invitaciones por WhatsApp: cuándo se le envió
--        la invitación a cada invitado
-- =============================================================

alter table public.guests
  add column invitation_sent_at timestamptz;

-- >>> 0008_mensajes.sql
-- =============================================================
-- 0008 · Textos editables de la invitación y del recordatorio
--        que se envían por WhatsApp
-- =============================================================

alter table public.wedding_settings
  add column invitation_template text check (length(invitation_template) <= 1000),
  add column reminder_template text check (length(reminder_template) <= 1000);

-- >>> 0009_acompanantes_rsvp.sql
-- =============================================================
-- 0009 · Al confirmar, el invitado escribe el nombre de cada
--        acompañante que trae
-- =============================================================

drop function if exists public.rsvp_submit(text, text, integer, text, text, text, boolean, jsonb);

create or replace function public.rsvp_submit(
  p_token text,
  p_status text,
  p_plus_ones integer,
  p_dietary text,
  p_message text,
  p_song text default null,
  p_needs_transport boolean default false,
  p_members jsonb default null,
  p_new_members jsonb default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_guest public.guests;
  v_deadline date;
  v_member_count integer;
  v_new_count integer;
  v_plus_ones integer := p_plus_ones;
  v_item jsonb;
begin
  select * into v_guest from public.guests where rsvp_token = p_token for update;
  if not found then
    raise exception 'invalid_token';
  end if;

  if p_status is null or p_status not in ('confirmado', 'rechazado') then
    raise exception 'invalid_status';
  end if;

  select rsvp_deadline into v_deadline from public.wedding_settings where id = 1;
  if v_deadline is not null and (now() at time zone 'America/Bogota')::date > v_deadline then
    raise exception 'deadline_passed';
  end if;

  if length(coalesce(p_dietary, '')) > 500
     or length(coalesce(p_message, '')) > 1000
     or length(coalesce(p_song, '')) > 200 then
    raise exception 'text_too_long';
  end if;

  select count(*) into v_member_count from public.guest_members where guest_id = v_guest.id;

  if p_status = 'confirmado'
     and p_new_members is not null and jsonb_typeof(p_new_members) = 'array'
     and (p_members is null or jsonb_array_length(p_members) = 0) then
    -- El invitado escribió los nombres de sus acompañantes: reemplazan la lista
    select count(*) into v_new_count
    from jsonb_array_elements_text(p_new_members) as n
    where length(trim(n)) between 1 and 120;

    if v_new_count <> jsonb_array_length(p_new_members) then
      raise exception 'invalid_member_name';
    end if;
    if v_new_count > v_guest.plus_ones_allowed then
      raise exception 'invalid_plus_ones';
    end if;

    delete from public.guest_members where guest_id = v_guest.id;
    insert into public.guest_members (guest_id, name, attending, sort_order)
    select v_guest.id, trim(n), true, i - 1
    from jsonb_array_elements_text(p_new_members) with ordinality as t(n, i);

    v_plus_ones := v_new_count;

  elsif v_member_count > 0 then
    -- Lista ya cargada por los novios: el invitado marca quién viene
    if p_members is not null and jsonb_typeof(p_members) = 'array' then
      for v_item in select * from jsonb_array_elements(p_members)
      loop
        if length(coalesce(v_item ->> 'dietary', '')) > 200 then
          raise exception 'text_too_long';
        end if;
        update public.guest_members
        set attending = case when p_status = 'confirmado' then coalesce((v_item ->> 'attending')::boolean, false) else false end,
            dietary = nullif(trim(v_item ->> 'dietary'), '')
        where id = (v_item ->> 'id')::uuid
          and guest_id = v_guest.id;
      end loop;
    end if;
    if p_status = 'rechazado' then
      update public.guest_members set attending = false where guest_id = v_guest.id;
    end if;
    select count(*) into v_plus_ones
    from public.guest_members
    where guest_id = v_guest.id and attending;
  end if;

  if p_status = 'confirmado'
     and (v_plus_ones is null or v_plus_ones < 0 or v_plus_ones > v_guest.plus_ones_allowed) then
    raise exception 'invalid_plus_ones';
  end if;

  update public.guests
  set rsvp_status = p_status::public.rsvp_status,
      plus_ones_confirmed = case when p_status = 'confirmado' then v_plus_ones else 0 end,
      dietary = nullif(trim(p_dietary), ''),
      guest_message = nullif(trim(p_message), ''),
      song_request = nullif(trim(p_song), ''),
      needs_transport = case when p_status = 'confirmado' then coalesce(p_needs_transport, false) else false end,
      rsvp_responded_at = now()
  where id = v_guest.id;

  return public.rsvp_get(p_token);
end;
$$;

revoke all on function public.rsvp_submit(text, text, integer, text, text, text, boolean, jsonb, jsonb) from public;
grant execute on function public.rsvp_submit(text, text, integer, text, text, text, boolean, jsonb, jsonb) to anon, authenticated;

-- >>> 0010_circulos.sql
-- =============================================================
-- 0010 · Círculo de cada invitado (primos, universidad, trabajo…)
--        para armar las mesas por afinidad, no solo por grupo
-- =============================================================

alter table public.guests
  add column circle text check (length(trim(circle)) between 1 and 60);

create index guests_circle_idx on public.guests (circle);

-- >>> 0011_mesas_fijas.sql
-- =============================================================
-- 0011 · Mesas fijas: las que el reparto automático no debe tocar
--        (mesa principal, la de los papás, la de los padrinos)
-- =============================================================

alter table public.seating_tables
  add column locked boolean not null default false;

-- >>> 0012_blindar_acompanantes.sql
-- =============================================================
-- 0012 · Blindaje: la lista de acompañantes que cargaron los novios
--        no se puede reemplazar desde el link público
-- =============================================================
-- Antes bastaba con no mandar p_members para que p_new_members borrara la
-- lista (con sus edades). Ahora esa rama solo corre si el invitado no tiene
-- acompañantes cargados.

create or replace function public.rsvp_submit(
  p_token text,
  p_status text,
  p_plus_ones integer,
  p_dietary text,
  p_message text,
  p_song text default null,
  p_needs_transport boolean default false,
  p_members jsonb default null,
  p_new_members jsonb default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_guest public.guests;
  v_deadline date;
  v_member_count integer;
  v_new_count integer;
  v_plus_ones integer := p_plus_ones;
  v_item jsonb;
begin
  select * into v_guest from public.guests where rsvp_token = p_token for update;
  if not found then
    raise exception 'invalid_token';
  end if;

  if p_status is null or p_status not in ('confirmado', 'rechazado') then
    raise exception 'invalid_status';
  end if;

  select rsvp_deadline into v_deadline from public.wedding_settings where id = 1;
  if v_deadline is not null and (now() at time zone 'America/Bogota')::date > v_deadline then
    raise exception 'deadline_passed';
  end if;

  if length(coalesce(p_dietary, '')) > 500
     or length(coalesce(p_message, '')) > 1000
     or length(coalesce(p_song, '')) > 200 then
    raise exception 'text_too_long';
  end if;

  select count(*) into v_member_count from public.guest_members where guest_id = v_guest.id;

  if p_status = 'confirmado'
     and v_member_count = 0
     and p_new_members is not null and jsonb_typeof(p_new_members) = 'array' then
    -- Nadie le había cargado acompañantes: los escribe el invitado
    select count(*) into v_new_count
    from jsonb_array_elements_text(p_new_members) as n
    where length(trim(n)) between 1 and 120;

    if v_new_count <> jsonb_array_length(p_new_members) then
      raise exception 'invalid_member_name';
    end if;
    if v_new_count > v_guest.plus_ones_allowed then
      raise exception 'invalid_plus_ones';
    end if;

    insert into public.guest_members (guest_id, name, attending, sort_order)
    select v_guest.id, trim(n), true, i - 1
    from jsonb_array_elements_text(p_new_members) with ordinality as t(n, i);

    v_plus_ones := v_new_count;

  elsif v_member_count > 0 then
    -- Lista ya cargada: el invitado marca quién viene
    if p_members is not null and jsonb_typeof(p_members) = 'array' then
      for v_item in select * from jsonb_array_elements(p_members)
      loop
        if length(coalesce(v_item ->> 'dietary', '')) > 200 then
          raise exception 'text_too_long';
        end if;
        update public.guest_members
        set attending = case when p_status = 'confirmado' then coalesce((v_item ->> 'attending')::boolean, false) else false end,
            dietary = nullif(trim(v_item ->> 'dietary'), '')
        where id = (v_item ->> 'id')::uuid
          and guest_id = v_guest.id;
      end loop;
    end if;
    if p_status = 'rechazado' then
      update public.guest_members set attending = false where guest_id = v_guest.id;
    end if;
    select count(*) into v_plus_ones
    from public.guest_members
    where guest_id = v_guest.id and attending;
  end if;

  if p_status = 'confirmado'
     and (v_plus_ones is null or v_plus_ones < 0 or v_plus_ones > v_guest.plus_ones_allowed) then
    raise exception 'invalid_plus_ones';
  end if;

  update public.guests
  set rsvp_status = p_status::public.rsvp_status,
      plus_ones_confirmed = case when p_status = 'confirmado' then v_plus_ones else 0 end,
      dietary = nullif(trim(p_dietary), ''),
      guest_message = nullif(trim(p_message), ''),
      song_request = nullif(trim(p_song), ''),
      needs_transport = case when p_status = 'confirmado' then coalesce(p_needs_transport, false) else false end,
      rsvp_responded_at = now()
  where id = v_guest.id;

  return public.rsvp_get(p_token);
end;
$$;

commit;

-- =============================================================
-- ÚLTIMO PASO (obligatorio)
-- Cambia los dos correos por los que usaron al crear los usuarios en
-- Authentication → Users y ejecuta también este bloque.
-- =============================================================
insert into public.app_users (email, display_name) values
  ('correo-de-robinson@ejemplo.com', 'Robinson'),
  ('correo-de-angela@ejemplo.com', 'Ángela')
on conflict (email) do update set display_name = excluded.display_name;
