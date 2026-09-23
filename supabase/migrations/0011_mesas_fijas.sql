-- =============================================================
-- 0011 · Mesas fijas: las que el reparto automático no debe tocar
--        (mesa principal, la de los papás, la de los padrinos)
-- =============================================================

alter table public.seating_tables
  add column locked boolean not null default false;
