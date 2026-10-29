-- =============================================================================
-- Guide de première connexion : avancement mémorisé sur la fiche (reprise à l'étape suivante).
-- Modifiable par l'adhérent lui-même (le garde-fou de la fiche ne bloque pas ces colonnes).
-- Rollback : supabase/rollbacks/20261112000000_onboarding.down.sql
-- =============================================================================

alter table public.members
  add column onboarding_step smallint not null default 0, -- dernière étape terminée
  add column onboarding_done_at timestamptz;               -- guide terminé ou passé
