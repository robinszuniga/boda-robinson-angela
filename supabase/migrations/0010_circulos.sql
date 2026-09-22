-- =============================================================
-- 0010 · Círculo de cada invitado (primos, universidad, trabajo…)
--        para armar las mesas por afinidad, no solo por grupo
-- =============================================================

alter table public.guests
  add column circle text check (length(trim(circle)) between 1 and 60);

create index guests_circle_idx on public.guests (circle);
