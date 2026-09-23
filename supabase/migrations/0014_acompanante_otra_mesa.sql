-- =============================================================
-- 0014 · Un acompañante puede sentarse en otra mesa, sin dejar de
--        pertenecer a su invitación (p. ej. los primos que llegan
--        con la abuela pero se sientan con los primos)
-- =============================================================

alter table public.guest_members
  add column table_id uuid references public.seating_tables (id) on delete set null;

create index guest_members_table_idx on public.guest_members (table_id);
