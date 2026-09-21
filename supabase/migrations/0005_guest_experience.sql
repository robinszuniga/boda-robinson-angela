-- =============================================================
-- 0005 · Experiencia del invitado, lluvia de sobres, acompañantes
--        con nombre y función para mantener activo el proyecto
-- =============================================================

-- Información extra para la página del invitado
alter table public.wedding_settings
  add column dress_code text,
  add column logistics_info text,
  add column lodging_info text,
  add column faq text,
  add column livestream_url text,
  add column photo_album_url text,
  add column show_table_to_guests boolean not null default false,
  add column envelope_rain boolean not null default false,
  add column ask_song boolean not null default true,
  add column offer_transport boolean not null default false;

alter table public.guests
  add column song_request text,
  add column needs_transport boolean not null default false,
  add column rsvp_reminded_at timestamptz;

-- Monto de sobres o aportes en efectivo (privado, solo lo ven los novios)
alter table public.gifts_received
  add column amount numeric(14, 2) check (amount >= 0);

-- Acompañantes con nombre dentro de una invitación (grupo familiar)
create table public.guest_members (
  id uuid primary key default gen_random_uuid(),
  guest_id uuid not null references public.guests (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  attending boolean,
  dietary text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index guest_members_guest_idx on public.guest_members (guest_id);

alter table public.guest_members enable row level security;
create policy couple_all on public.guest_members
  for all to authenticated
  using ((select public.is_couple())) with check ((select public.is_couple()));
revoke all on public.guest_members from anon;

-- -------------------------------------------------------------
-- RSVP público actualizado
-- -------------------------------------------------------------
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
  v_table jsonb;
begin
  if p_token is null or length(p_token) < 16 or length(p_token) > 64 then
    return null;
  end if;

  select * into v_guest from public.guests where rsvp_token = p_token;
  if not found then
    return null;
  end if;

  select * into v_settings from public.wedding_settings where id = 1;

  -- La mesa solo se muestra si los novios lo activaron y el invitado confirmó
  if v_settings.show_table_to_guests and v_guest.rsvp_status = 'confirmado' and v_guest.table_id is not null then
    select jsonb_build_object('number', t.number, 'name', t.name)
    into v_table
    from public.seating_tables t
    where t.id = v_guest.table_id;
  end if;

  return jsonb_build_object(
    'guest', jsonb_build_object(
      'name', v_guest.name,
      'plus_ones_allowed', v_guest.plus_ones_allowed,
      'plus_ones_confirmed', v_guest.plus_ones_confirmed,
      'rsvp_status', v_guest.rsvp_status,
      'dietary', v_guest.dietary,
      'guest_message', v_guest.guest_message,
      'song_request', v_guest.song_request,
      'needs_transport', v_guest.needs_transport,
      'responded_at', v_guest.rsvp_responded_at,
      'table', v_table,
      'members', coalesce((
        select jsonb_agg(
          jsonb_build_object('id', m.id, 'name', m.name, 'attending', m.attending, 'dietary', m.dietary)
          order by m.sort_order, m.created_at
        )
        from public.guest_members m
        where m.guest_id = v_guest.id
      ), '[]'::jsonb)
    ),
    'wedding', jsonb_build_object(
      'partner_1_name', v_settings.partner_1_name,
      'partner_2_name', v_settings.partner_2_name,
      'wedding_date', v_settings.wedding_date,
      'venue_name', v_settings.venue_name,
      'venue_address', v_settings.venue_address,
      'rsvp_deadline', v_settings.rsvp_deadline,
      'guest_message', v_settings.guest_message,
      'dress_code', v_settings.dress_code,
      'logistics_info', v_settings.logistics_info,
      'lodging_info', v_settings.lodging_info,
      'faq', v_settings.faq,
      'livestream_url', v_settings.livestream_url,
      'photo_album_url', v_settings.photo_album_url,
      'envelope_rain', v_settings.envelope_rain,
      'ask_song', v_settings.ask_song,
      'offer_transport', v_settings.offer_transport
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

drop function if exists public.rsvp_submit(text, text, integer, text, text);

create or replace function public.rsvp_submit(
  p_token text,
  p_status text,
  p_plus_ones integer,
  p_dietary text,
  p_message text,
  p_song text default null,
  p_needs_transport boolean default false,
  p_members jsonb default null
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

  if v_member_count > 0 then
    -- Con acompañantes con nombre, los que vienen se marcan uno por uno
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

revoke all on function public.rsvp_submit(text, text, integer, text, text, text, boolean, jsonb) from public;
grant execute on function public.rsvp_submit(text, text, integer, text, text, text, boolean, jsonb) to anon, authenticated;

-- -------------------------------------------------------------
-- Keep-alive: el plan gratis de Supabase pausa proyectos con poca
-- actividad durante 7 días. Una tarea diaria llama a esta función.
-- -------------------------------------------------------------
create or replace function public.keep_alive()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from public.wedding_settings;
$$;

revoke all on function public.keep_alive() from public;
grant execute on function public.keep_alive() to anon, authenticated;
