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
