-- =============================================================================
-- Compo du soir : nombre d'équipes fixé à la main par le Bureau (ajout / suppression d'une équipe).
-- null = nombre calculé automatiquement (CLAUDE.md, étape 1).
-- Rollback : supabase/rollbacks/20261109000000_lineup_team_count.down.sql
-- =============================================================================

alter table public.lineups
  add column forced_teams smallint check (forced_teams between 2 and 20);
