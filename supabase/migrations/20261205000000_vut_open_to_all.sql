-- =============================================================================
-- VUT ouvert à tous les adhérents (novembre 2026).
-- 1) Remise à zéro complète de la phase de test : collections, boosters (cadeaux, booster du jour
--    et série compris), compos, classements, éclats, marché, simulations ; notes de forme à 60.
-- 2) Lecture du jeu ouverte à tous les adhérents (était : Bureau seulement).
-- Les Légendes (liste et pouvoirs) et les photos ne changent pas.
-- =============================================================================

delete from public.game_listings;      -- offres effacées en cascade
delete from public.game_lineups;
delete from public.game_weeks;
delete from public.game_collection;
delete from public.game_boosters;
delete from public.game_wallet;
delete from public.game_test_results;
delete from public.game_team_results;  -- aucun score réel saisi : uniquement des essais
delete from public.game_team_form;     -- sans ligne, la note vaut 60

drop policy "classement" on public.game_weeks;
create policy "classement" on public.game_weeks for select to authenticated using (public.is_member());
drop policy "joueurs VUT" on public.game_legends;
create policy "joueurs VUT" on public.game_legends for select to authenticated using (public.is_member());
drop policy "joueurs VUT" on public.game_team_results;
create policy "joueurs VUT" on public.game_team_results for select to authenticated using (public.is_member());
drop policy "joueurs VUT" on public.game_listings;
create policy "joueurs VUT" on public.game_listings for select to authenticated using (public.is_member());

-- Toutes les cartes du club, visibles de tous les adhérents.
drop view public.game_cards;
create view public.game_cards with (security_invoker = false) as
  -- Communes : poste 1.
  select mt.member_id, mt.team_id, t.name as team_name, m.first_name, m.last_name, m.sex,
         case when m.position_1 = 'front' then 'front_left'::public.court_position else m.position_1 end as position,
         'common'::text as kind,
         coalesce(f.rating, 60) as rating, coalesce(f.best_rating, 60) as best_rating,
         case when m.image_consent then m.photo_updated_at end as photo_updated_at,
         null::text as legend_bonus, false as is_dev
  from public.member_teams mt
  join public.members m on m.id = mt.member_id
  join public.teams t on t.id = mt.team_id
  left join public.game_team_form f on f.team_id = mt.team_id
  where m.position_1 is not null and public.is_member()
  union all
  -- Rares : poste 2.
  select mt.member_id, mt.team_id, t.name, m.first_name, m.last_name, m.sex,
         case when m.position_2 = 'front' then 'front_left'::public.court_position else m.position_2 end,
         'rare',
         coalesce(f.rating, 60), coalesce(f.best_rating, 60),
         case when m.image_consent then m.photo_updated_at end,
         null, false
  from public.member_teams mt
  join public.members m on m.id = mt.member_id
  join public.teams t on t.id = mt.team_id
  left join public.game_team_form f on f.team_id = mt.team_id
  where m.position_2 is not null and public.is_member()
  union all
  -- Ultra rares : capitaines (une carte, leur 1re équipe par ordre alphabétique), portrait détouré.
  select c.member_id, c.team_id, c.team_name, m.first_name, m.last_name, m.sex,
         coalesce(case when m.position_1 = 'front' then 'front_left'::public.court_position else m.position_1 end, 'setter'),
         'captain',
         coalesce(f.rating, 60), coalesce(f.best_rating, 60),
         case when m.image_consent then m.photo_updated_at end, null, false
  from (
    select distinct on (r.member_id) r.member_id, r.team_id, t.name as team_name
    from public.member_roles r join public.teams t on t.id = r.team_id
    where r.role = 'captain'
    order by r.member_id, t.name
  ) c
  join public.members m on m.id = c.member_id
  left join public.game_team_form f on f.team_id = c.team_id
  where public.is_member()
  union all
  -- Légendes : membres du Bureau ayant un bonus, note 99, sans équipe, photo dorée.
  select l.member_id, null::uuid, 'Bureau', m.first_name, m.last_name, m.sex,
         coalesce(case when m.position_1 = 'front' then 'front_left'::public.court_position else m.position_1 end, 'setter'),
         'legend', 99, 99, case when m.image_consent then m.photo_updated_at end, l.bonus, l.is_dev
  from public.game_legends l
  join public.members m on m.id = l.member_id
  where public.is_member();
revoke all on public.game_cards from anon;
grant select on public.game_cards to authenticated;
