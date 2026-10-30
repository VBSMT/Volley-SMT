-- =============================================================================
-- VUT (Volley Ultimate Team), jeu de cartes du club (style FUT). Pour l'instant réservé au Bureau
-- (phase de test) : vue des cartes limitée au Bureau. : cartes, note de forme, boosters, collection, photos.
-- Une carte = un joueur dans une équipe, au poste 1. Le sexe est visible dans le jeu (décision du
-- club : règle « au moins une fille ») ; le niveau ne l'est jamais.
-- Photos : l'adhérent ajoute la sienne, seulement avec le droit à l'image ; retirer ce droit
-- efface la photo. Fichiers dans le bucket privé « photos », servis par l'appli aux adhérents.
-- Rollback : supabase/rollbacks/20261117000000_game.down.sql
-- =============================================================================

-- Version de la photo (null : pas de photo). Le fichier est photos/{member_id}.webp.
alter table public.members add column photo_updated_at timestamptz;

create function public.members_photo_consent() returns trigger
language plpgsql set search_path = public as $$
begin
  if not new.image_consent then new.photo_updated_at := null; end if;
  return new;
end $$;
create trigger members_photo_consent
  before insert or update of image_consent, photo_updated_at on public.members
  for each row execute function public.members_photo_consent();

insert into storage.buckets (id, name, public) values ('photos', 'photos', false) on conflict (id) do nothing;

-- Note de forme de chaque équipe, recalculée à la synchro volley34 (photo du classement).
create table public.game_team_form (
  team_id      uuid primary key references public.teams (id) on delete cascade,
  recent       smallint[] not null default '{}',   -- points du barème des 5 derniers matchs
  last_scores  jsonb,                              -- compteurs de scores de la dernière photo
  rating       smallint not null default 60,
  best_rating  smallint not null default 60,       -- record de la saison
  updated_at   timestamptz not null default now()
);
alter table public.game_team_form enable row level security;
revoke all on public.game_team_form from anon;
create policy "lecture adhérents" on public.game_team_form for select to authenticated using (public.is_member());

-- Cartes du club : joueurs des équipes ayant un poste 1 (l'ancien « avant » devient Avant (4)).
create view public.game_cards with (security_invoker = false) as
  select mt.member_id, mt.team_id, t.name as team_name, m.first_name, m.last_name, m.sex,
         case when m.position_1 = 'front' then 'front_left'::public.court_position else m.position_1 end as position,
         coalesce(f.rating, 60) as rating, coalesce(f.best_rating, 60) as best_rating,
         case when m.image_consent then m.photo_updated_at end as photo_updated_at
  from public.member_teams mt
  join public.members m on m.id = mt.member_id
  join public.teams t on t.id = mt.team_id
  left join public.game_team_form f on f.team_id = mt.team_id
  where m.position_1 is not null and public.is_board();
revoke all on public.game_cards from anon;
grant select on public.game_cards to authenticated;

-- Boosters : « starter » (6 cartes, un seul par joueur) puis boosters gagnés.
create table public.game_boosters (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.members (id) on delete cascade,
  kind        text not null check (kind in ('starter', 'earned')),
  reason      text,
  cards       jsonb,                                -- cartes tirées à l'ouverture
  created_at  timestamptz not null default now(),
  opened_at   timestamptz
);
create unique index game_boosters_one_starter on public.game_boosters (owner_id) where kind = 'starter';
create index on public.game_boosters (owner_id);

-- Collection : nombre d'exemplaires de chaque carte.
create table public.game_collection (
  owner_id           uuid not null references public.members (id) on delete cascade,
  member_id          uuid not null references public.members (id) on delete cascade,
  team_id            uuid not null references public.teams (id) on delete cascade,
  copies             smallint not null default 1 check (copies > 0),
  first_obtained_at  timestamptz not null default now(),
  primary key (owner_id, member_id, team_id)
);

-- Chacun ne voit que ses boosters et sa collection ; les écritures passent par le serveur.
alter table public.game_boosters enable row level security;
alter table public.game_collection enable row level security;
revoke all on public.game_boosters, public.game_collection from anon;
create policy "les siens" on public.game_boosters for select to authenticated using (owner_id = public.current_member_id());
create policy "la sienne" on public.game_collection for select to authenticated using (owner_id = public.current_member_id());
