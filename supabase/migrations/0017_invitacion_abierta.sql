-- =============================================================
-- 0017 · Saber si el invitado abrió su invitación
--        WhatsApp no avisa si el mensaje llegó o se leyó, pero sí se
--        puede saber cuándo el invitado abrió su link: así se distingue
--        "no la ha abierto" de "la abrió y no ha respondido".
--        Solo cuenta un navegador de verdad (las vistas previas de
--        WhatsApp no ejecutan la página) y nunca los novios con sesión
--        iniciada, que abren los links para revisarlos.
-- =============================================================

alter table public.guests
  add column rsvp_opened_at timestamptz;

create or replace function public.rsvp_mark_opened(p_token text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if public.is_couple() then
    return;
  end if;
  -- Solo la primera vez: es lo que dice si la abrió
  update public.guests
  set rsvp_opened_at = now()
  where rsvp_token = p_token
    and rsvp_opened_at is null;
end;
$$;

revoke all on function public.rsvp_mark_opened(text) from public;
grant execute on function public.rsvp_mark_opened(text) to anon, authenticated;
