drop view if exists public.team_roster;
create view public.team_roster with (security_invoker = false) as
  select mt.team_id, m.id as member_id, m.first_name, m.last_name
  from public.member_teams mt join public.members m on m.id = mt.member_id
  where public.is_member();
revoke all on public.team_roster from anon;
grant select on public.team_roster to authenticated;
