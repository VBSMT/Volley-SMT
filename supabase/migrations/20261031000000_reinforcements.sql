-- =============================================================================
-- Préférences de notification, demandes de renfort, journal étendu aux matchs.
-- Rollback : supabase/rollbacks/20261031000000_reinforcements.down.sql
-- =============================================================================

-- Préférences (modifiables par l'adhérent : colonnes non protégées par members_guard_update).
alter table public.members
  add column notify_training      boolean not null default true,
  add column notify_match         boolean not null default true,
  add column notify_reinforcement boolean not null default true;

-- -----------------------------------------------------------------------------
-- Renforts
-- -----------------------------------------------------------------------------
create type public.reinforcement_status as enum ('open', 'filled', 'cancelled');

create table public.reinforcement_requests (
  id          uuid primary key default gen_random_uuid(),
  match_id    uuid not null references public.matches (id) on delete cascade,
  team_id     uuid not null references public.teams (id) on delete cascade,
  captain_id  uuid references public.members (id) on delete set null,
  position    public.court_position,          -- null = indifférent
  sex         public.sex,                     -- null = indifférent
  note        text check (char_length(note) <= 300),
  status      public.reinforcement_status not null default 'open',
  created_at  timestamptz not null default now(),
  closed_at   timestamptz
);
create index on public.reinforcement_requests (status);

create table public.reinforcement_offers (
  request_id  uuid not null references public.reinforcement_requests (id) on delete cascade,
  member_id   uuid not null references public.members (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (request_id, member_id)
);

alter table public.reinforcement_requests enable row level security;
alter table public.reinforcement_offers   enable row level security;
revoke all on public.reinforcement_requests, public.reinforcement_offers from anon;

create function public.is_captain_of_request(r uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.reinforcement_requests q where q.id = r and public.is_captain_of(q.team_id))
$$;

-- Demandes : visibles par tout adhérent ; créées par le capitaine pour un match de son équipe.
create policy "lecture adhérents" on public.reinforcement_requests for select to authenticated
  using (public.is_member());
create policy "capitaine demande" on public.reinforcement_requests for insert to authenticated
  with check (
    captain_id = public.current_member_id()
    and status = 'open'
    and public.is_captain_of(team_id)
    and exists (
      select 1 from public.matches m
      where m.id = match_id and m.team_id = reinforcement_requests.team_id and m.starts_at > now()
    )
  );
create policy "capitaine clôt" on public.reinforcement_requests for update to authenticated
  using (public.is_captain_of(team_id))
  with check (public.is_captain_of(team_id));
create policy "Bureau gère" on public.reinforcement_requests for all to authenticated
  using (public.is_board()) with check (public.is_board());

-- Propositions : chacun voit la sienne ; le capitaine de l'équipe et le Bureau voient tout.
create policy "sa proposition, capitaine ou Bureau" on public.reinforcement_offers for select to authenticated
  using (member_id = public.current_member_id() or public.is_captain_of_request(request_id) or public.is_board());
create policy "proposer son aide" on public.reinforcement_offers for insert to authenticated
  with check (
    member_id = public.current_member_id()
    and exists (
      select 1 from public.reinforcement_requests q
      join public.matches m on m.id = q.match_id
      where q.id = request_id and q.status = 'open' and m.starts_at > now()
    )
  );
create policy "retirer sa proposition" on public.reinforcement_offers for delete to authenticated
  using (member_id = public.current_member_id());
create policy "Bureau gère" on public.reinforcement_offers for all to authenticated
  using (public.is_board()) with check (public.is_board());

-- -----------------------------------------------------------------------------
-- Journal des notifications : aussi pour les matchs (J-2) et les renforts.
-- -----------------------------------------------------------------------------
alter table public.notification_log
  alter column session_id drop not null,
  add column match_id         uuid references public.matches (id) on delete cascade,
  add column reinforcement_id uuid references public.reinforcement_requests (id) on delete cascade,
  add constraint notification_log_one_target check (
    num_nonnulls(session_id, match_id, reinforcement_id) = 1
  ),
  add constraint notification_log_match_key unique (kind, match_id, member_id),
  add constraint notification_log_reinforcement_key unique (kind, reinforcement_id, member_id);
