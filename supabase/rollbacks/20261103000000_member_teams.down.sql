-- Retour à une seule équipe : la première équipe (par date d'ajout) est conservée.
alter table public.members add column team_id uuid references public.teams (id) on delete set null;
update public.members m set team_id = (
  select mt.team_id from public.member_teams mt where mt.member_id = m.id order by mt.created_at limit 1
);
drop view if exists public.team_roster;
drop view if exists public.member_directory;
create view public.member_directory with (security_invoker = false) as
  select id, first_name, last_name, team_id from public.members where public.is_member();
grant select on public.member_directory to authenticated;
drop policy "destinataires" on public.announcements;
create policy "destinataires" on public.announcements for select to authenticated using (
  public.is_board()
  or (public.is_member() and target = 'club')
  or (target = 'team' and team_id = (select team_id from public.members where user_id = auth.uid()))
  or (target = 'volunteers' and public.has_role('volunteer'))
  or (target = 'session' and exists (
        select 1 from public.attendance a
        where a.session_id = announcements.session_id
          and a.member_id = public.current_member_id() and a.present))
);
create or replace function public.plays_in_match_team(m uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.matches x join public.members me on me.team_id = x.team_id
    where x.id = m and me.user_id = auth.uid()
  )
$$;
drop function if exists public.in_team(uuid);
drop table if exists public.member_teams;
