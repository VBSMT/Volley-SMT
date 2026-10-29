delete from public.notification_log where session_id is null;
alter table public.notification_log
  drop constraint if exists notification_log_reinforcement_key,
  drop constraint if exists notification_log_match_key,
  drop constraint if exists notification_log_one_target,
  drop column if exists reinforcement_id,
  drop column if exists match_id,
  alter column session_id set not null;
drop table if exists public.reinforcement_offers;
drop table if exists public.reinforcement_requests;
drop function if exists public.is_captain_of_request(uuid);
drop type if exists public.reinforcement_status;
alter table public.members
  drop column if exists notify_reinforcement,
  drop column if exists notify_match,
  drop column if exists notify_training;
