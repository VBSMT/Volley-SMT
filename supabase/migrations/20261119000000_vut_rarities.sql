-- =============================================================================
-- VUT : raretés des cartes et case Bonus.
-- - commune : poste 1 ; rare : poste 2 (10 % au tirage) ;
-- - ultra rare : capitaines (3 %, une carte par capitaine, sa 1re équipe) ;
-- - légende : membres du Bureau ayant un bonus (0,5 %, note 99, sans équipe : « Bureau »).
-- Photos seulement sur les communes et les rares.
-- Rollback : supabase/rollbacks/20261119000000_vut_rarities.down.sql
-- =============================================================================

-- Bonus des Légendes (un par membre du Bureau), décidé par le club.
create table public.game_legends (
  member_id  uuid primary key references public.members (id) on delete cascade,
  bonus      text not null unique check (bonus in ('per_win', 'back_x5', 'setter_x4', 'front_x2_5', 'bench_x2', 'five_girls', 'all_win_30')),
  is_dev     boolean not null default false   -- carte unique du développeur de l'appli
);
alter table public.game_legends enable row level security;
revoke all on public.game_legends from anon;
create policy "joueurs VUT" on public.game_legends for select to authenticated using (public.is_board());

-- Attribution (liste du club, octobre 2026) : prénom d'un membre du Bureau → bonus.
insert into public.game_legends (member_id, bonus, is_dev)
select m.id, v.bonus, v.is_dev
from (values
  ('jerome', 'per_win', false),
  ('xavier', 'back_x5', false),
  ('owen', 'setter_x4', false),
  ('ratsiam', 'front_x2_5', false),
  ('lydie', 'bench_x2', false),
  ('guylaine', 'five_girls', false),
  ('benjamin', 'all_win_30', true)
) as v (first_name, bonus, is_dev)
join public.members m on translate(lower(m.first_name), 'éèêëàâîïôöûüç', 'eeeeaaiioouuc') = v.first_name
where exists (select 1 from public.member_roles r where r.member_id = m.id and r.role = 'board')
  -- Un prénom porté par deux membres du Bureau : pas d'attribution automatique (à faire à la main).
  and (select count(*) from public.members m2
       join public.member_roles r2 on r2.member_id = m2.id and r2.role = 'board'
       where translate(lower(m2.first_name), 'éèêëàâîïôöûüç', 'eeeeaaiioouuc') = v.first_name) = 1
on conflict do nothing;

-- Collection et équipes : rareté de la carte ; pas d'équipe pour une Légende.
alter table public.game_collection add column kind text not null default 'common'
  check (kind in ('common', 'rare', 'captain', 'legend'));
alter table public.game_collection drop constraint game_collection_pkey;
alter table public.game_collection alter column team_id drop not null;
alter table public.game_collection add constraint game_collection_card unique nulls not distinct (owner_id, member_id, team_id, kind);

alter table public.game_lineups add column kind text not null default 'common'
  check (kind in ('common', 'rare', 'captain', 'legend'));
alter table public.game_lineups alter column team_id drop not null;
alter table public.game_lineups drop constraint game_lineups_slot_check;
alter table public.game_lineups add constraint game_lineups_slot_check
  check (slot in ('setter', 'front_left', 'front_right', 'back', 'sub', 'bonus'));

-- Toutes les cartes du club, par rareté.
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
  -- Ultra rares : capitaines (une carte, leur 1re équipe par ordre alphabétique), sans photo.
  select c.member_id, c.team_id, c.team_name, m.first_name, m.last_name, m.sex,
         coalesce(case when m.position_1 = 'front' then 'front_left'::public.court_position else m.position_1 end, 'setter'),
         'captain',
         coalesce(f.rating, 60), coalesce(f.best_rating, 60),
         null::timestamptz, null, false
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
  -- Légendes : membres du Bureau ayant un bonus, note 99, sans équipe, sans photo.
  select l.member_id, null::uuid, 'Bureau', m.first_name, m.last_name, m.sex,
         coalesce(case when m.position_1 = 'front' then 'front_left'::public.court_position else m.position_1 end, 'setter'),
         'legend', 99, 99, null::timestamptz, l.bonus, l.is_dev
  from public.game_legends l
  join public.members m on m.id = l.member_id
  where public.is_board();
revoke all on public.game_cards from anon;
grant select on public.game_cards to authenticated;
