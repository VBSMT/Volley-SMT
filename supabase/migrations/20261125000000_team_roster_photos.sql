-- Fiches équipes : la photo (seulement avec le droit à l'image) remplace les initiales sur le terrain.
-- Le niveau et le sexe restent hors de la vue.
create or replace view public.team_roster with (security_invoker = false) as
  select mt.team_id, m.id as member_id, m.first_name, m.last_name,
         m.position_1, m.position_2,
         exists (
           select 1 from public.member_roles r
           where r.member_id = m.id and r.role = 'captain' and r.team_id = mt.team_id
         ) as is_captain,
         case when m.image_consent then m.photo_updated_at end as photo_updated_at
  from public.member_teams mt join public.members m on m.id = mt.member_id
  where public.is_member();
