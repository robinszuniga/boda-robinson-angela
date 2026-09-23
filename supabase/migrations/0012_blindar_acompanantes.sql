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
