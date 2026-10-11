-- =============================================================
-- 0016 · Plano del salón
--        Cada mesa tiene forma, posición y giro, y el salón tiene
--        sus elementos (pista, tarima, baños, entrada, bar…) para
--        ubicar las mesas respecto a ellos. Sin posición, la mesa
--        aparece en la zona de "sin ubicar" del plano.
-- =============================================================

create type public.table_shape as enum ('redonda', 'rectangular', 'presidencial');

alter table public.seating_tables
  add column shape public.table_shape not null default 'redonda',
  add column pos_x real check (pos_x between -10000 and 10000),
  add column pos_y real check (pos_y between -10000 and 10000),
  add column rotation smallint not null default 0 check (rotation between 0 and 359),
  -- Las dos coordenadas van juntas: o la mesa está ubicada o no
  add constraint seating_tables_pos_both check ((pos_x is null) = (pos_y is null));

create type public.venue_element_kind as enum ('pista', 'tarima', 'banos', 'entrada', 'bar', 'buffet', 'otro');

create table public.venue_elements (
  id uuid primary key default gen_random_uuid(),
  kind public.venue_element_kind not null default 'otro',
  label text check (length(trim(label)) between 1 and 40),
  pos_x real not null default 0 check (pos_x between -10000 and 10000),
  pos_y real not null default 0 check (pos_y between -10000 and 10000),
  width real not null default 160 check (width between 20 and 3000),
  height real not null default 100 check (height between 20 and 3000),
  rotation smallint not null default 0 check (rotation between 0 and 359),
  created_at timestamptz not null default now()
);

alter table public.venue_elements enable row level security;
create policy couple_all on public.venue_elements
  for all to authenticated
  using ((select public.is_couple())) with check ((select public.is_couple()));
revoke all on public.venue_elements from anon;
