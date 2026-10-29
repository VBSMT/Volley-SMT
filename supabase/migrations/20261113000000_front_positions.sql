-- =============================================================================
-- Postes avant précisés : Avant (2) = à droite au filet, Avant (4) = à gauche.
-- « front » reste valable : ancien choix (côté non précisé) et poste « avant » des demandes de renfort.
-- Pas de rollback simple (une valeur d'enum ne se retire pas) : valeurs inutilisées sans effet.
-- =============================================================================

alter type public.court_position add value if not exists 'front_right';
alter type public.court_position add value if not exists 'front_left';
