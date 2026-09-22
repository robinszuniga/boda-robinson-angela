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
