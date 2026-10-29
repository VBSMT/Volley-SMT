-- Tests des droits (RLS) par rôle : `supabase test db` (base locale, Docker).
begin;
create extension if not exists pgtap with schema extensions;
select plan(28);

-- Jeu de données : une équipe, quatre personnes (adhérent, capitaine, bénévole, Bureau).
insert into public.teams (id, name) values
  ('00000000-0000-0000-0000-0000000000a1', 'Équipe A'),
  ('00000000-0000-0000-0000-0000000000a2', 'Équipe B');
insert into public.members (id, email, first_name, last_name, sex) values
  ('00000000-0000-0000-0000-000000000001', 'adh@test.fr', 'Ada', 'Hérent', 'F'),
  ('00000000-0000-0000-0000-000000000002', 'cap@test.fr', 'Cap', 'Itaine', 'M'),
  ('00000000-0000-0000-0000-000000000003', 'ben@test.fr', 'Béné', 'Vole', 'F'),
  ('00000000-0000-0000-0000-000000000004', 'bur@test.fr', 'Bu', 'Reau', 'M');
insert into public.member_teams (member_id, team_id) values
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000a1');
insert into public.member_roles (member_id, role, team_id) values
  ('00000000-0000-0000-0000-000000000001', 'member', null),
  ('00000000-0000-0000-0000-000000000002', 'member', null),
  ('00000000-0000-0000-0000-000000000002', 'captain', '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-000000000003', 'member', null),
  ('00000000-0000-0000-0000-000000000003', 'volunteer', null),
  ('00000000-0000-0000-0000-000000000004', 'member', null),
  ('00000000-0000-0000-0000-000000000004', 'board', null);
-- Comptes : le déclencheur rattache chaque compte à sa fiche par email.
insert into auth.users (id, email) values
  ('10000000-0000-0000-0000-000000000001', 'adh@test.fr'),
  ('10000000-0000-0000-0000-000000000002', 'cap@test.fr'),
  ('10000000-0000-0000-0000-000000000003', 'ben@test.fr'),
  ('10000000-0000-0000-0000-000000000004', 'bur@test.fr');
insert into public.gyms (code, name, full_name, lat, lon) values ('G1', 'Gymnase', 'Gymnase (Ville)', 43.6, 3.9);
insert into public.member_levels (member_id, level) values ('00000000-0000-0000-0000-000000000001', 3);
insert into public.seasons (id, label, starts_on, ends_on) values
  ('00000000-0000-0000-0000-0000000000c1', 'test', current_date - 30, current_date + 300);
insert into public.training_sessions (id, season_id, starts_at, ends_at) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000c1', now() + interval '2 days', now() + interval '2 days 2 hours');
insert into public.lineups (session_id, free_courts, teams) values ('00000000-0000-0000-0000-0000000000d1', 3, '[]');
insert into public.matches (id, team_id, opponent, starts_at, is_home) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000a1', 'Adversaire', now() + interval '5 days', true),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000a2', 'Autre', now() + interval '5 days', true);
insert into public.events (id, type, title, starts_at, visible_roles) values
  ('00000000-0000-0000-0000-0000000000f1', 'other', 'Pour tous', now() + interval '10 days', '{}'),
  ('00000000-0000-0000-0000-0000000000f2', 'other', 'Bénévoles', now() + interval '10 days', '{volunteer}');

-- Se connecter en tant que l'utilisateur n (1 adhérent, 2 capitaine, 3 bénévole, 4 Bureau).
create function pg_temp.login(n int) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', '10000000-0000-0000-0000-00000000000' || n, 'role', 'authenticated')::text, true);
end $$;
create function pg_temp.logout() returns void language sql as $$ select set_config('role', 'postgres', true) $$;

-- Adhérent
select pg_temp.login(1);
select is((select count(*) from public.member_levels)::int, 0, 'adhérent : niveaux invisibles');
select is((select count(*) from public.lineups)::int, 0, 'adhérent : compo invisible');
select is((select count(*) from public.gyms)::int, 1, 'adhérent : lit les gymnases');
select is((select is_captain from public.team_roster where member_id = '00000000-0000-0000-0000-000000000002'), true, 'adhérent : voit le capitaine de l''équipe');
select hasnt_column('public', 'team_roster', 'level', 'la fiche équipe n''expose pas le niveau');
select is((select count(*) from public.events)::int, 1, 'adhérent : seulement les événements pour tous');
select lives_ok($$ insert into public.attendance (session_id, member_id, present)
  values ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-000000000001', true) $$, 'adhérent : répond pour lui');
select throws_ok($$ insert into public.attendance (session_id, member_id, present)
  values ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-000000000003', true) $$, '42501', null, 'adhérent : ne répond pas pour un autre');
select is((select count(*) from public.attendance)::int, 1, 'adhérent : voit les réponses (nominatif)');
select throws_ok($$ insert into public.match_polls (match_id, created_by)
  values ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-000000000001') $$, '42501', null, 'adhérent : ne lance pas de sondage de match');
update public.members set last_name = 'Pirate' where id = '00000000-0000-0000-0000-000000000003';
select lives_ok($$ update public.members set onboarding_step = 3 where id = '00000000-0000-0000-0000-000000000001' $$, 'adhérent : enregistre l''avancement de son guide');
select throws_ok($$ select public.set_member_positions('00000000-0000-0000-0000-000000000002', 'setter', null) $$, '42501', null, 'adhérent : ne modifie pas les postes d''un autre');
select pg_temp.logout();
select is((select last_name from public.members where id = '00000000-0000-0000-0000-000000000003'), 'Vole', 'adhérent : ne modifie pas la fiche d''un autre');

-- Capitaine
select pg_temp.login(2);
select is((select count(*) from public.member_levels)::int, 0, 'capitaine : niveaux invisibles');
select lives_ok($$ insert into public.match_polls (match_id, created_by)
  values ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-000000000002') $$, 'capitaine : sondage pour son équipe');
select throws_ok($$ insert into public.match_polls (match_id, created_by)
  values ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-000000000002') $$, '42501', null, 'capitaine : pas pour une autre équipe');

select lives_ok($$ select public.set_member_positions('00000000-0000-0000-0000-000000000001', 'back', 'front') $$, 'capitaine : modifie les postes d''un joueur de son équipe');
select throws_ok($$ select public.set_member_positions('00000000-0000-0000-0000-000000000003', 'back', null) $$, '42501', null, 'capitaine : pas un joueur hors de son équipe');
select pg_temp.logout();
select is((select position_1::text from public.members where id = '00000000-0000-0000-0000-000000000001'), 'back', 'postes enregistrés');

-- Bénévole
select pg_temp.login(3);
select is((select count(*) from public.events)::int, 2, 'bénévole : voit l''événement réservé aux bénévoles');
select is((select count(*) from public.lineups)::int, 0, 'bénévole : compo invisible');
select pg_temp.logout();

-- Bureau
select pg_temp.login(4);
select is((select count(*) from public.member_levels)::int, 1, 'Bureau : voit les niveaux');
select is((select count(*) from public.lineups)::int, 1, 'Bureau : voit la compo');
select is((select count(*) from public.events)::int, 2, 'Bureau : voit tous les événements');
select lives_ok($$ insert into public.attendance (session_id, member_id, present)
  values ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-000000000003', true) $$, 'Bureau : ajoute un présent');
select lives_ok($$ delete from public.attendance where member_id = '00000000-0000-0000-0000-000000000001' $$, 'Bureau : retire un présent');
select pg_temp.logout();
select is((select count(*) from public.attendance)::int, 1, 'Bureau : ajout et retrait appliqués');

-- Non connecté
set local role anon;
select throws_ok('select * from public.members', '42501', null, 'anonyme : aucun accès aux fiches');

select * from finish();
rollback;
