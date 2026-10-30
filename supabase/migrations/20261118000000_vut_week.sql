-- =============================================================================
-- VUT (2/3) : équipe de la journée (semaine du lundi au dimanche), points, classements.
-- Remise à zéro des boosters et collections (demande du Bureau, phase de test).
-- Réservé au Bureau pour l'instant (comme la vue game_cards).
-- Rollback : supabase/rollbacks/20261118000000_vut_week.down.sql
-- =============================================================================

delete from public.game_collection;
delete from public.game_boosters;

-- Équipe de la semaine : un joueur par place (4 titulaires + remplaçant).
create table public.game_lineups (
  owner_id    uuid not null references public.members (id) on delete cascade,
  week_start  date not null,                 -- lundi (heure de Paris)
  slot        text not null check (slot in ('setter', 'front_left', 'front_right', 'back', 'sub')),
  member_id   uuid not null references public.members (id) on delete cascade,
  team_id     uuid not null references public.teams (id) on delete cascade,
  updated_at  timestamptz not null default now(),
  primary key (owner_id, week_start, slot)
);

-- Semaine d'un joueur : validation (départage) et points (provisoires puis définitifs le lundi).
create table public.game_weeks (
  owner_id      uuid not null references public.members (id) on delete cascade,
  week_start    date not null,
  validated_at  timestamptz not null default now(),
  total         numeric(6, 1) not null default 0,
  bonus         numeric(6, 1) not null default 0,
  detail        jsonb,
  computed_at   timestamptz,
  primary key (owner_id, week_start)
);
create index on public.game_weeks (week_start);

alter table public.game_lineups enable row level security;
alter table public.game_weeks enable row level security;
revoke all on public.game_lineups, public.game_weeks from anon;
-- Sa propre équipe ; les écritures passent par le serveur (règles et verrouillage vérifiés).
create policy "la sienne" on public.game_lineups for select to authenticated using (owner_id = public.current_member_id());
-- Classements : visibles des joueurs de VUT (le Bureau pour l'instant).
create policy "classement" on public.game_weeks for select to authenticated using (public.is_board());

-- Outils de test du Bureau : résultats simulés (remplacent les vrais pour l'équipe et la semaine).
create table public.game_test_results (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references public.teams (id) on delete cascade,
  week_start  date not null,
  score       text not null check (score in ('s30', 's31', 's32', 's23', 's13', 's03')),
  created_at  timestamptz not null default now()
);
alter table public.game_test_results enable row level security;
revoke all on public.game_test_results from anon;
create policy "Bureau" on public.game_test_results for select to authenticated using (public.is_board());
