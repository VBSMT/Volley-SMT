-- =============================================================================
-- Migration initiale Volley SMT : tables, rôles, RLS.
-- Rollback : supabase/rollbacks/20261028000000_initial_schema.down.sql
-- =============================================================================

create extension if not exists citext;

-- -----------------------------------------------------------------------------
-- Types énumérés
-- -----------------------------------------------------------------------------
create type public.app_role as enum ('member', 'captain', 'volunteer', 'board');
create type public.sex as enum ('F', 'M');
create type public.court_position as enum ('setter', 'front', 'back'); -- passe / avant / fond
create type public.request_status as enum ('pending', 'approved', 'rejected');
create type public.reschedule_status as enum ('requested', 'approved', 'rejected', 'confirmed', 'abandoned');
create type public.event_type as enum ('tournament', 'town_event', 'members_meal', 'other');
create type public.announcement_target as enum ('club', 'team', 'volunteers', 'session');
create type public.match_source as enum ('excel', 'volley34', 'manual');

-- -----------------------------------------------------------------------------
-- Référentiels
-- -----------------------------------------------------------------------------
create table public.seasons (
  id         uuid primary key default gen_random_uuid(),
  label      text not null unique,            -- ex. « 2026-2027 »
  starts_on  date not null,
  ends_on    date not null,
  check (ends_on > starts_on)
);

create table public.teams (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,
  volley34_ref  text unique,
  created_at    timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Adhérents
-- -----------------------------------------------------------------------------
create table public.members (
  id                       uuid primary key default gen_random_uuid(),
  user_id                  uuid unique references auth.users (id) on delete set null,
  email                    citext not null unique,
  first_name               text not null,
  last_name                text not null,
  sex                      public.sex not null,
  team_id                  uuid references public.teams (id) on delete set null,
  -- Modifiables par l'adhérent
  phone                    text,
  emergency_contact_name   text,
  emergency_contact_phone  text,
  image_consent            boolean not null default false,
  position_1               public.court_position,
  position_2               public.court_position,
  -- Gérés par le Bureau
  fsgt_license             text,
  license_season_id        uuid references public.seasons (id) on delete set null,
  dues_paid                boolean not null default false,
  last_membership_ends_on  date,              -- sert à la purge RGPD (+2 ans)
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  check (position_2 is null or position_2 <> position_1)
);
create index on public.members (team_id);

-- Rôles cumulables ; `captain` rattaché à une équipe.
create table public.member_roles (
  id         uuid primary key default gen_random_uuid(),
  member_id  uuid not null references public.members (id) on delete cascade,
  role       public.app_role not null,
  team_id    uuid references public.teams (id) on delete cascade,
  check ((role = 'captain') = (team_id is not null))
);
create unique index member_roles_unique on public.member_roles (member_id, role, coalesce(team_id, '00000000-0000-0000-0000-000000000000'));

-- Niveau : Bureau uniquement. Supprimé dès la fin de l'adhésion.
create table public.member_levels (
  member_id   uuid primary key references public.members (id) on delete cascade,
  level       smallint not null check (level between 1 and 5),
  updated_at  timestamptz not null default now()
);

create table public.volunteer_requests (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references public.members (id) on delete cascade,
  status      public.request_status not null default 'pending',
  created_at  timestamptz not null default now(),
  decided_by  uuid references public.members (id) on delete set null,
  decided_at  timestamptz
);
create unique index volunteer_requests_one_pending on public.volunteer_requests (member_id) where status = 'pending';

create table public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references public.members (id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Séances d'entraînement, présence, compo
-- -----------------------------------------------------------------------------
create table public.training_sessions (
  id            uuid primary key default gen_random_uuid(),
  season_id     uuid not null references public.seasons (id) on delete cascade,
  starts_at     timestamptz not null unique,
  ends_at       timestamptz not null,
  is_closed_day boolean not null default false,   -- vacances zone C / jour férié
  open_courts   smallint not null default 3 check (open_courts between 0 and 3),
  poll_closed_at timestamptz,
  check (ends_at > starts_at)
);

create table public.attendance (
  session_id  uuid not null references public.training_sessions (id) on delete cascade,
  member_id   uuid not null references public.members (id) on delete cascade,
  present     boolean not null,
  answered_at timestamptz not null default now(),
  primary key (session_id, member_id)
);

-- Compo du soir : Bureau uniquement.
create table public.lineups (
  session_id    uuid primary key references public.training_sessions (id) on delete cascade,
  generated_at  timestamptz not null default now(),
  free_courts   smallint not null,
  teams         jsonb not null,               -- [[member_id, ...], ...]
  warnings      jsonb not null default '[]'   -- contraintes non tenues
);

-- -----------------------------------------------------------------------------
-- Matchs et reports
-- -----------------------------------------------------------------------------
create table public.matches (
  id            uuid primary key default gen_random_uuid(),
  team_id       uuid not null references public.teams (id) on delete cascade,
  opponent      text not null,
  competition   text not null default 'championnat',
  starts_at     timestamptz not null,
  is_home       boolean not null,
  session_id    uuid references public.training_sessions (id) on delete set null, -- créneau occupé si domicile
  venue         text,
  volley34_ref  text unique,
  source        public.match_source not null default 'excel',
  updated_at    timestamptz not null default now()
);
create index on public.matches (team_id, starts_at);
create index on public.matches (session_id);

create table public.reschedule_requests (
  id                    uuid primary key default gen_random_uuid(),
  match_id              uuid not null references public.matches (id) on delete cascade,
  requested_session_id  uuid not null references public.training_sessions (id) on delete cascade,
  status                public.reschedule_status not null default 'requested',
  requested_by          uuid references public.members (id) on delete set null,
  note                  text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index on public.reschedule_requests (status);

create table public.reschedule_events (
  id           bigint generated always as identity primary key,
  request_id   uuid not null references public.reschedule_requests (id) on delete cascade,
  actor_id     uuid references public.members (id) on delete set null,  -- null = tâche planifiée
  from_status  public.reschedule_status,
  to_status    public.reschedule_status not null,
  note         text,
  created_at   timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Événements et sondages
-- -----------------------------------------------------------------------------
create table public.events (
  id                   uuid primary key default gen_random_uuid(),
  type                 public.event_type not null,
  title                text not null,
  starts_at            timestamptz not null,
  location             text,
  description          text,
  attendance_poll      boolean not null default false,
  ask_partner          boolean not null default false,
  ask_children         boolean not null default false,
  ask_guests           boolean not null default false,
  volunteer_poll       boolean not null default false,
  created_by           uuid references public.members (id) on delete set null,
  created_at           timestamptz not null default now()
);

create table public.event_attendance (
  event_id      uuid not null references public.events (id) on delete cascade,
  member_id     uuid not null references public.members (id) on delete cascade,
  coming        boolean not null,
  with_partner  boolean,
  children      smallint check (children >= 0),
  guests        smallint check (guests >= 0),
  answered_at   timestamptz not null default now(),
  primary key (event_id, member_id)
);

create table public.event_volunteer_needs (
  id        uuid primary key default gen_random_uuid(),
  event_id  uuid not null references public.events (id) on delete cascade,
  label     text not null,                    -- ex. « buvette »
  needed    smallint not null check (needed > 0),
  unique (event_id, label)
);

create table public.event_volunteer_signups (
  event_id    uuid not null references public.events (id) on delete cascade,
  member_id   uuid not null references public.members (id) on delete cascade,
  available   boolean not null,
  need_id     uuid references public.event_volunteer_needs (id) on delete set null,
  answered_at timestamptz not null default now(),
  primary key (event_id, member_id)
);

-- -----------------------------------------------------------------------------
-- Bureau : annonces, liens, paramètres, synchro
-- -----------------------------------------------------------------------------
create table public.announcements (
  id          uuid primary key default gen_random_uuid(),
  author_id   uuid references public.members (id) on delete set null,
  target      public.announcement_target not null,
  team_id     uuid references public.teams (id) on delete cascade,
  session_id  uuid references public.training_sessions (id) on delete cascade,
  title       text not null,
  body        text not null,
  created_at  timestamptz not null default now(),
  check ((target = 'team') = (team_id is not null)),
  check ((target = 'session') = (session_id is not null))
);

create table public.useful_links (
  id        uuid primary key default gen_random_uuid(),
  label     text not null,
  url       text not null,
  position  smallint not null default 0
);

create table public.app_settings (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now()
);

insert into public.app_settings (key, value) values
  ('level_scale', '{"min":1,"max":5}'),
  ('poll_reminder', '{"days_before":2,"time":"20:00"}'),
  ('poll_close_time', '"12:00"'),
  ('reschedule_expiry_days', '3');

create table public.sync_runs (
  id           bigint generated always as identity primary key,
  source       public.match_source not null,
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  success      boolean,
  message      text
);

-- =============================================================================
-- Fonctions d'aide aux droits (security definer : évitent la récursion RLS)
-- =============================================================================
create function public.current_member_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.members where user_id = auth.uid()
$$;

create function public.has_role(r public.app_role) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.member_roles mr
    join public.members m on m.id = mr.member_id
    where m.user_id = auth.uid() and mr.role = r
  )
$$;

create function public.is_board() returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_role('board')
$$;

create function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select public.current_member_id() is not null
$$;

create function public.is_captain_of(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.member_roles mr
    join public.members m on m.id = mr.member_id
    where m.user_id = auth.uid() and mr.role = 'captain' and mr.team_id = t
  )
$$;

-- Liaison automatique compte Auth ↔ fiche importée (même email).
create function public.link_auth_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.members set user_id = new.id
  where email = new.email::citext and user_id is null;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.link_auth_user();

-- Un adhérent ne modifie que ses champs autorisés.
create function public.members_guard_update() returns trigger
language plpgsql set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_board() and (
       new.user_id      is distinct from old.user_id
    or new.email        is distinct from old.email
    or new.first_name   is distinct from old.first_name
    or new.last_name    is distinct from old.last_name
    or new.sex          is distinct from old.sex
    or new.team_id      is distinct from old.team_id
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

create trigger members_guard_update
  before update on public.members
  for each row execute function public.members_guard_update();

-- Reports : un capitaine ne peut que créer `requested` ou passer à `abandoned` ;
-- `updated_at` tenu à jour et journal alimenté automatiquement.
create function public.reschedule_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_board() then
    if tg_op = 'INSERT' and new.status <> 'requested' then
      raise exception 'Statut initial invalide' using errcode = '42501';
    end if;
    if tg_op = 'UPDATE' and (new.status <> 'abandoned'
        or old.status not in ('requested', 'approved')
        or new.match_id <> old.match_id
        or new.requested_session_id <> old.requested_session_id) then
      raise exception 'Transition réservée au Bureau' using errcode = '42501';
    end if;
  end if;
  if tg_op = 'UPDATE' and old.status = 'confirmed' and new.status <> 'confirmed' then
    raise exception 'Report déjà confirmé';
  end if;
  new.updated_at := now();
  return new;
end $$;

create trigger reschedule_guard
  before insert or update on public.reschedule_requests
  for each row execute function public.reschedule_guard();

create function public.reschedule_log() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.reschedule_events (request_id, actor_id, from_status, to_status, note)
    values (new.id, public.current_member_id(),
            case when tg_op = 'UPDATE' then old.status end, new.status, new.note);
  end if;
  return null;
end $$;

create trigger reschedule_log
  after insert or update on public.reschedule_requests
  for each row execute function public.reschedule_log();

-- Annuaire minimal (nom, prénom, équipe) pour les sondages nominatifs :
-- n'expose ni coordonnées ni niveau.
create view public.member_directory with (security_invoker = false) as
  select id, first_name, last_name, team_id
  from public.members
  where public.is_member();

-- =============================================================================
-- RLS
-- =============================================================================
alter table public.seasons                  enable row level security;
alter table public.teams                    enable row level security;
alter table public.members                  enable row level security;
alter table public.member_roles             enable row level security;
alter table public.member_levels            enable row level security;
alter table public.volunteer_requests       enable row level security;
alter table public.push_subscriptions       enable row level security;
alter table public.training_sessions        enable row level security;
alter table public.attendance               enable row level security;
alter table public.lineups                  enable row level security;
alter table public.matches                  enable row level security;
alter table public.reschedule_requests      enable row level security;
alter table public.reschedule_events        enable row level security;
alter table public.events                   enable row level security;
alter table public.event_attendance         enable row level security;
alter table public.event_volunteer_needs    enable row level security;
alter table public.event_volunteer_signups  enable row level security;
alter table public.announcements            enable row level security;
alter table public.useful_links             enable row level security;
alter table public.app_settings             enable row level security;
alter table public.sync_runs                enable row level security;

-- Le rôle anon n'a accès à rien.
revoke all on all tables in schema public from anon;
revoke all on public.member_directory from anon;
grant select on public.member_directory to authenticated;

-- Lecture pour tout adhérent, écriture Bureau ------------------------------
create policy "lecture adhérents" on public.seasons           for select to authenticated using (public.is_member());
create policy "Bureau gère"       on public.seasons           for all    to authenticated using (public.is_board()) with check (public.is_board());
create policy "lecture adhérents" on public.teams             for select to authenticated using (public.is_member());
create policy "Bureau gère"       on public.teams             for all    to authenticated using (public.is_board()) with check (public.is_board());
create policy "lecture adhérents" on public.training_sessions for select to authenticated using (public.is_member());
create policy "Bureau gère"       on public.training_sessions for all    to authenticated using (public.is_board()) with check (public.is_board());
create policy "lecture adhérents" on public.matches           for select to authenticated using (public.is_member());
create policy "Bureau gère"       on public.matches           for all    to authenticated using (public.is_board()) with check (public.is_board());
create policy "lecture adhérents" on public.events            for select to authenticated using (public.is_member());
create policy "Bureau gère"       on public.events            for all    to authenticated using (public.is_board()) with check (public.is_board());
create policy "lecture adhérents" on public.useful_links      for select to authenticated using (public.is_member());
create policy "Bureau gère"       on public.useful_links      for all    to authenticated using (public.is_board()) with check (public.is_board());

-- Bureau uniquement ---------------------------------------------------------
create policy "Bureau seul" on public.member_levels for all to authenticated using (public.is_board()) with check (public.is_board());
create policy "Bureau seul" on public.lineups       for all to authenticated using (public.is_board()) with check (public.is_board());
create policy "Bureau seul" on public.app_settings  for all to authenticated using (public.is_board()) with check (public.is_board());
create policy "Bureau seul" on public.sync_runs     for all to authenticated using (public.is_board()) with check (public.is_board());
create policy "Bureau seul" on public.reschedule_events for select to authenticated using (public.is_board());

-- Fiches adhérents ----------------------------------------------------------
create policy "sa fiche ou Bureau" on public.members for select to authenticated
  using (user_id = auth.uid() or public.is_board());
create policy "modif sa fiche ou Bureau" on public.members for update to authenticated
  using (user_id = auth.uid() or public.is_board())
  with check (user_id = auth.uid() or public.is_board());
create policy "Bureau crée" on public.members for insert to authenticated with check (public.is_board());
create policy "Bureau supprime" on public.members for delete to authenticated using (public.is_board());

create policy "ses rôles ou Bureau" on public.member_roles for select to authenticated
  using (member_id = public.current_member_id() or public.is_board());
create policy "Bureau gère" on public.member_roles for all to authenticated
  using (public.is_board()) with check (public.is_board());

-- Demandes « Devenir bénévole » ---------------------------------------------
create policy "sa demande ou Bureau" on public.volunteer_requests for select to authenticated
  using (member_id = public.current_member_id() or public.is_board());
create policy "créer sa demande" on public.volunteer_requests for insert to authenticated
  with check (member_id = public.current_member_id() and status = 'pending' and decided_by is null);
create policy "Bureau décide" on public.volunteer_requests for update to authenticated
  using (public.is_board()) with check (public.is_board());

-- Abonnements push ----------------------------------------------------------
create policy "ses abonnements" on public.push_subscriptions for all to authenticated
  using (member_id = public.current_member_id())
  with check (member_id = public.current_member_id());

-- Présence aux séances (nominatif : lecture par tous) -----------------------
create policy "lecture adhérents" on public.attendance for select to authenticated using (public.is_member());
create policy "répondre pour soi" on public.attendance for insert to authenticated
  with check (member_id = public.current_member_id() and exists (
    select 1 from public.training_sessions s where s.id = session_id and s.poll_closed_at is null and s.starts_at > now()));
create policy "modifier sa réponse" on public.attendance for update to authenticated
  using (member_id = public.current_member_id())
  with check (member_id = public.current_member_id() and exists (
    select 1 from public.training_sessions s where s.id = session_id and s.poll_closed_at is null and s.starts_at > now()));
create policy "Bureau gère" on public.attendance for all to authenticated
  using (public.is_board()) with check (public.is_board());

-- Reports -------------------------------------------------------------------
create policy "lecture adhérents" on public.reschedule_requests for select to authenticated using (public.is_member());
create policy "capitaine demande" on public.reschedule_requests for insert to authenticated
  with check (requested_by = public.current_member_id() and exists (
    select 1 from public.matches m where m.id = match_id and public.is_captain_of(m.team_id)));
create policy "capitaine abandonne" on public.reschedule_requests for update to authenticated
  using (exists (select 1 from public.matches m where m.id = match_id and public.is_captain_of(m.team_id)))
  with check (exists (select 1 from public.matches m where m.id = match_id and public.is_captain_of(m.team_id)));
create policy "Bureau gère" on public.reschedule_requests for all to authenticated
  using (public.is_board()) with check (public.is_board());

-- Sondages d'événements -----------------------------------------------------
create policy "lecture adhérents" on public.event_attendance for select to authenticated using (public.is_member());
create policy "répondre pour soi" on public.event_attendance for all to authenticated
  using (member_id = public.current_member_id())
  with check (member_id = public.current_member_id()
    and exists (select 1 from public.events e where e.id = event_id and e.attendance_poll));
create policy "Bureau gère" on public.event_attendance for all to authenticated
  using (public.is_board()) with check (public.is_board());

create policy "lecture bénévoles" on public.event_volunteer_needs for select to authenticated
  using (public.has_role('volunteer') or public.is_board());
create policy "Bureau gère" on public.event_volunteer_needs for all to authenticated
  using (public.is_board()) with check (public.is_board());

create policy "lecture bénévoles" on public.event_volunteer_signups for select to authenticated
  using (public.has_role('volunteer') or public.is_board());
create policy "répondre pour soi" on public.event_volunteer_signups for all to authenticated
  using (member_id = public.current_member_id())
  with check (member_id = public.current_member_id() and public.has_role('volunteer')
    and exists (select 1 from public.events e where e.id = event_id and e.volunteer_poll));
create policy "Bureau gère" on public.event_volunteer_signups for all to authenticated
  using (public.is_board()) with check (public.is_board());

-- Annonces : visibles par leurs destinataires -------------------------------
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
create policy "Bureau gère" on public.announcements for all to authenticated
  using (public.is_board()) with check (public.is_board());
