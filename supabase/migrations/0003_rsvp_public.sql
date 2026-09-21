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
