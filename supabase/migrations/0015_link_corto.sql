-- =============================================================
-- 0015 · Link corto de cada invitado
--        La invitación se manda con un link acortado para que no
--        muestre la dirección larga de GitHub Pages. Si está vacío
--        la app usa el link normal, así que nunca queda sin link.
-- =============================================================

alter table public.guests
  add column short_url text
    check (short_url ~ '^https://[a-z0-9.-]+\.[a-z]{2,}/\S+$' and length(short_url) <= 200);
