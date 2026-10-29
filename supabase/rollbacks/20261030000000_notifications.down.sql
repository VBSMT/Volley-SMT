select cron.unschedule('volley-smt-tick');
update public.app_settings set value = '{"days_before":2,"time":"20:00"}' where key = 'poll_reminder';
drop table if exists public.notification_log;
