alter table public.matches drop constraint if exists matches_team_competition_phase_round_key;
alter table public.matches
  drop column if exists division,
  drop column if exists phase,
  drop column if exists round,
  drop column if exists city;
