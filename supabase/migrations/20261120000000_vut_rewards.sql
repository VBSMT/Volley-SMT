-- =============================================================================
-- VUT (3/3) : boosters gagnés automatiquement, éclats, fin de saison.
-- Rollback : supabase/rollbacks/20261120000000_vut_rewards.down.sql
-- =============================================================================

-- Chaque récompense ne rapporte qu'un booster (raison unique par joueur ; « test » exclu :
-- les outils de test du Bureau peuvent en donner plusieurs).
create unique index game_boosters_one_reward on public.game_boosters (owner_id, reason)
  where kind = 'earned' and reason is not null and reason <> 'test';

-- Éclats : 1 par doublon ouvert ; 5 éclats = une carte commune ou rare au choix.
create table public.game_wallet (
  owner_id  uuid primary key references public.members (id) on delete cascade,
  shards    integer not null default 0 check (shards >= 0)
);
alter table public.game_wallet enable row level security;
revoke all on public.game_wallet from anon;
create policy "le sien" on public.game_wallet for select to authenticated using (owner_id = public.current_member_id());
