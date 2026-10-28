-- =============================================================================
-- Détails des matchs pour l'import du calendrier (fichier Excel du club).
-- Rollback : supabase/rollbacks/20261029000000_match_details.down.sql
-- =============================================================================

alter table public.matches
  add column division text,          -- ex. « Niveau 2 - Poule : 1 »
  add column phase    text,          -- « Aller » / « Retour » (la journée repart à 1 au Retour)
  add column round    smallint,      -- journée
  add column city     text;

-- Identifie un match d'un import à l'autre (la date peut changer après un report).
alter table public.matches
  add constraint matches_team_competition_phase_round_key unique (team_id, competition, phase, round);
