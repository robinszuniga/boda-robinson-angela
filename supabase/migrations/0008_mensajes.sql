-- =============================================================
-- 0008 · Textos editables de la invitación y del recordatorio
--        que se envían por WhatsApp
-- =============================================================

alter table public.wedding_settings
  add column invitation_template text check (length(invitation_template) <= 1000),
  add column reminder_template text check (length(reminder_template) <= 1000);
