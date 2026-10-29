-- =============================================================================
-- Horaires (notification J-1, clôture du sondage, expiration des reports) lisibles par
-- tout adhérent ; les autres réglages restent réservés au Bureau.
-- Rollback : supabase/rollbacks/20261107000000_schedule_settings.down.sql
-- =============================================================================
create view public.schedule_settings with (security_invoker = false) as
  select key, value from public.app_settings
  where key in ('poll_reminder', 'poll_close_time', 'reschedule_expiry_days') and public.is_member();

revoke all on public.schedule_settings from anon;
grant select on public.schedule_settings to authenticated;

-- Valeurs par défaut si absentes (idempotent).
insert into public.app_settings (key, value) values
  ('poll_reminder', '{"days_before":1,"time":"20:00"}'),
  ('poll_close_time', '"12:00"'),
  ('reschedule_expiry_days', '3')
on conflict (key) do nothing;
