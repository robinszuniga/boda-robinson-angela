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
