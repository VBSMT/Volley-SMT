-- VUT : photo (avec droit à l'image) aussi sur les cartes Capitaine et Légende.
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
  where m.position_1 is not null and public.is_board()
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
  where m.position_2 is not null and public.is_board()
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
  where public.is_board()
  union all
  -- Légendes : membres du Bureau ayant un bonus, note 99, sans équipe, photo dorée.
  select l.member_id, null::uuid, 'Bureau', m.first_name, m.last_name, m.sex,
         coalesce(case when m.position_1 = 'front' then 'front_left'::public.court_position else m.position_1 end, 'setter'),
         'legend', 99, 99, case when m.image_consent then m.photo_updated_at end, l.bonus, l.is_dev
  from public.game_legends l
  join public.members m on m.id = l.member_id
  where public.is_board();
revoke all on public.game_cards from anon;
grant select on public.game_cards to authenticated;
