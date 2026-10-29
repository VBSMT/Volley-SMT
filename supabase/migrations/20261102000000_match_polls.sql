-- =============================================================================
-- Sondage de présence d'un match, lancé par le capitaine de l'équipe.
-- Rollback : supabase/rollbacks/20261102000000_match_polls.down.sql
-- =============================================================================

create table public.match_polls (
  match_id    uuid primary key references public.matches (id) on delete cascade,
  created_by  uuid references public.members (id) on delete set null,
  created_at  timestamptz not null default now()
);

create table public.match_availability (
  match_id     uuid not null references public.match_polls (match_id) on delete cascade,
  member_id    uuid not null references public.members (id) on delete cascade,
  available    boolean not null,
  answered_at  timestamptz not null default now(),
  primary key (match_id, member_id)
);

alter table public.match_polls        enable row level security;
alter table public.match_availability enable row level security;
revoke all on public.match_polls, public.match_availability from anon;

-- L'adhérent connecté joue-t-il dans l'équipe de ce match ?
create function public.plays_in_match_team(m uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.matches x
    join public.members me on me.team_id = x.team_id
    where x.id = m and me.user_id = auth.uid()
  )
$$;

create function public.is_captain_of_match(m uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.matches x where x.id = m and public.is_captain_of(x.team_id))
$$;

-- Sondages : visibles par l'équipe, le capitaine et le Bureau ; lancés par le capitaine.
create policy "équipe, capitaine ou Bureau" on public.match_polls for select to authenticated
  using (public.plays_in_match_team(match_id) or public.is_captain_of_match(match_id) or public.is_board());
create policy "capitaine lance" on public.match_polls for insert to authenticated
  with check (
    created_by = public.current_member_id()
    and public.is_captain_of_match(match_id)
    and exists (select 1 from public.matches x where x.id = match_id and x.starts_at > now())
  );
create policy "capitaine ou Bureau supprime" on public.match_polls for delete to authenticated
  using (public.is_captain_of_match(match_id) or public.is_board());

-- Réponses : visibles par l'équipe ; chaque joueur de l'équipe répond pour lui jusqu'au match.
create policy "équipe, capitaine ou Bureau" on public.match_availability for select to authenticated
  using (public.plays_in_match_team(match_id) or public.is_captain_of_match(match_id) or public.is_board());
create policy "répondre pour soi" on public.match_availability for insert to authenticated
  with check (
    member_id = public.current_member_id()
    and public.plays_in_match_team(match_id)
    and exists (select 1 from public.matches x where x.id = match_id and x.starts_at > now())
  );
create policy "modifier sa réponse" on public.match_availability for update to authenticated
  using (member_id = public.current_member_id())
  with check (
    member_id = public.current_member_id()
    and exists (select 1 from public.matches x where x.id = match_id and x.starts_at > now())
  );
create policy "Bureau gère" on public.match_availability for all to authenticated
  using (public.is_board()) with check (public.is_board());
