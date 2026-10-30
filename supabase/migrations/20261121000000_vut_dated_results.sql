-- =============================================================================
-- VUT : résultats rattachés à la date du match (un score publié en retard compte dans la
-- bonne semaine), semaines provisoires / définitives, alerte « API résultats disponible ».
-- Rollback : supabase/rollbacks/20261121000000_vut_dated_results.down.sql
-- =============================================================================

-- Résultat de chaque match d'une équipe du club, déduit des photos du classement.
create table public.game_team_results (
  id           uuid primary key default gen_random_uuid(),
  team_id      uuid not null references public.teams (id) on delete cascade,
  match_id     uuid unique references public.matches (id) on delete set null,
  played_at    timestamptz not null,
  score        text not null check (score in ('s30', 's31', 's32', 's23', 's13', 's03', 'fWon', 'fLost')),
  sets_won     smallint not null,
  sets_lost    smallint not null,
  points_won   smallint not null,
  points_lost  smallint not null,
  recorded_at  timestamptz not null default now()
);
create index on public.game_team_results (team_id, played_at);
alter table public.game_team_results enable row level security;
revoke all on public.game_team_results from anon;
create policy "joueurs VUT" on public.game_team_results for select to authenticated using (public.is_board());

-- Totaux de la dernière photo (sets, points) pour isoler les nouveaux résultats.
alter table public.game_team_form add column last_totals jsonb;

-- Semaine provisoire tant qu'un match n'a pas de résultat (figée 14 jours après sa fin).
alter table public.game_weeks add column final boolean not null default false;
alter table public.game_weeks add column pending text[] not null default '{}';  -- équipes en attente de résultat

-- Repères de la synchro (ex. première publication de l'API des résultats volley34).
create table public.sync_flags (
  key     text primary key,
  set_at  timestamptz not null default now()
);
alter table public.sync_flags enable row level security;
revoke all on public.sync_flags from anon, authenticated;
