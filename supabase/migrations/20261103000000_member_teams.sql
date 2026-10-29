-- =============================================================================
-- Plusieurs équipes par adhérent (ex. Totally Spike + une équipe mixte).
-- La colonne members.team_id est remplacée par la table member_teams.
-- Rollback : supabase/rollbacks/20261103000000_member_teams.down.sql
-- =============================================================================

create table public.member_teams (
  member_id   uuid not null references public.members (id) on delete cascade,
  team_id     uuid not null references public.teams (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (member_id, team_id)
);
create index on public.member_teams (team_id);

-- Reprise des équipes existantes.
insert into public.member_teams (member_id, team_id)
select id, team_id from public.members where team_id is not null;

alter table public.member_teams enable row level security;
revoke all on public.member_teams from anon;
-- La composition des équipes est connue de tous les adhérents ; le Bureau la gère.
create policy "lecture adhérents" on public.member_teams for select to authenticated using (public.is_member());
create policy "Bureau gère" on public.member_teams for all to authenticated
  using (public.is_board()) with check (public.is_board());

-- L'adhérent connecté joue-t-il dans cette équipe ?
create function public.in_team(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.member_teams mt
    join public.members m on m.id = mt.member_id
    where m.user_id = auth.uid() and mt.team_id = t
  )
$$;

create or replace function public.plays_in_match_team(m uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.matches x where x.id = m and public.in_team(x.team_id))
$$;

-- Annonces d'équipe : destinataires = toutes les équipes de l'adhérent.
drop policy "destinataires" on public.announcements;
create policy "destinataires" on public.announcements for select to authenticated using (
  public.is_board()
  or (public.is_member() and target = 'club')
  or (target = 'team' and public.in_team(team_id))
  or (target = 'volunteers' and public.has_role('volunteer'))
  or (target = 'session' and exists (
        select 1 from public.attendance a
        where a.session_id = announcements.session_id
          and a.member_id = public.current_member_id() and a.present))
);

-- Annuaire sans équipe + liste des joueurs par équipe (noms seulement, jamais de coordonnées).
drop view public.member_directory;
create view public.member_directory with (security_invoker = false) as
  select id, first_name, last_name from public.members where public.is_member();
create view public.team_roster with (security_invoker = false) as
  select mt.team_id, m.id as member_id, m.first_name, m.last_name
  from public.member_teams mt join public.members m on m.id = mt.member_id
  where public.is_member();
revoke all on public.member_directory, public.team_roster from anon;
grant select on public.member_directory, public.team_roster to authenticated;

-- Garde-fou de la fiche, sans la colonne supprimée.
create or replace function public.members_guard_update() returns trigger
language plpgsql set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_board() and (
       new.user_id      is distinct from old.user_id
    or new.email        is distinct from old.email
    or new.first_name   is distinct from old.first_name
    or new.last_name    is distinct from old.last_name
    or new.sex          is distinct from old.sex
    or new.fsgt_license is distinct from old.fsgt_license
    or new.license_season_id is distinct from old.license_season_id
    or new.dues_paid    is distinct from old.dues_paid
    or new.last_membership_ends_on is distinct from old.last_membership_ends_on
  ) then
    raise exception 'Champ non modifiable par l''adhérent' using errcode = '42501';
  end if;
  new.updated_at := now();
  return new;
end $$;

alter table public.members drop column team_id;
