drop table if exists public.sync_flags;
alter table public.game_weeks drop column if exists pending;
alter table public.game_weeks drop column if exists final;
alter table public.game_team_form drop column if exists last_totals;
drop table if exists public.game_team_results;
