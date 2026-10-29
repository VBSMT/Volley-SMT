-- =============================================================================
-- Notifications : journal des envois, réglage J-1, appel horaire de l'appli.
-- Rollback : supabase/rollbacks/20261030000000_notifications.down.sql
--
-- Prérequis (une fois, dans le SQL Editor — ce sont des secrets, pas du schéma) :
--   select vault.create_secret('https://volley-smt.vercel.app', 'app_url');
--   select vault.create_secret('<même valeur que CRON_SECRET dans Vercel>', 'cron_secret');
-- =============================================================================

-- Journal : une notification d'un type donné n'est envoyée qu'une fois par séance et par personne.
create table public.notification_log (
  id          bigint generated always as identity primary key,
  kind        text not null,                -- ask | remind | closure
  session_id  uuid not null references public.training_sessions (id) on delete cascade,
  member_id   uuid not null references public.members (id) on delete cascade,
  channel     text,                         -- push | email | none
  sent_at     timestamptz not null default now(),
  unique (kind, session_id, member_id)
);
-- Lu et écrit uniquement côté serveur (clé service_role) : aucune politique.
alter table public.notification_log enable row level security;
revoke all on public.notification_log from anon, authenticated;

-- Notification à J-1 (et non plus J-2), 20h par défaut.
update public.app_settings
set value = '{"days_before":1,"time":"20:00"}', updated_at = now()
where key = 'poll_reminder';

-- Appel horaire de l'appli : elle décide selon l'heure de Paris (gère l'heure d'été).
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'volley-smt-tick',
  '0 * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'app_url') || '/api/cron/tick',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);
