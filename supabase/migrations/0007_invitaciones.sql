-- =============================================================
-- 0007 · Envío de invitaciones por WhatsApp: cuándo se le envió
--        la invitación a cada invitado
-- =============================================================

alter table public.guests
  add column invitation_sent_at timestamptz;
