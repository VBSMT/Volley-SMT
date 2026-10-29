-- =============================================================================
-- Classements volley34 : une photo par équipe et par jour (onglet Stats, évolution du rang).
-- Rollback : supabase/rollbacks/20261106000000_standings.down.sql
-- =============================================================================

create table public.standings_snapshots (
  team_id     uuid not null references public.teams (id) on delete cascade,
  taken_on    date not null,                -- date (Paris) de la synchro
  rows        jsonb not null,               -- classement complet de la poule
  rank        smallint not null,
  pool_size   smallint not null,
  played      smallint not null,
  won         smallint not null,
  lost        smallint not null,
  points      smallint not null,
  set_diff    smallint not null,
  point_diff  integer not null,
  updated_at  timestamptz not null default now(),
  primary key (team_id, taken_on)
);

alter table public.standings_snapshots enable row level security;
revoke all on public.standings_snapshots from anon;
-- Données publiques de volley34 : lisibles par tout adhérent, écrites par la synchro (service_role).
create policy "lecture adhérents" on public.standings_snapshots for select to authenticated using (public.is_member());
