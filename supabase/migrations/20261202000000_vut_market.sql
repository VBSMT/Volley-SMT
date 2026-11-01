-- VUT : marché entre joueurs. Annonces (une carte contre des éclats et/ou une carte précise) et offres
-- (éclats et/ou cartes). Lecture : joueurs du jeu (Bureau pour l'instant) ; écriture par le serveur seulement.
create table public.game_listings (
  id             uuid primary key default gen_random_uuid(),
  seller_id      uuid not null references public.members (id) on delete cascade,
  member_id      uuid not null references public.members (id) on delete cascade,
  team_id        uuid not null references public.teams (id) on delete cascade,
  kind           text not null check (kind in ('common', 'rare', 'captain')),
  ask_shards     integer check (ask_shards >= 0),
  ask_member_id  uuid references public.members (id) on delete set null,
  ask_team_id    uuid references public.teams (id) on delete set null,
  ask_kind       text check (ask_kind in ('common', 'rare', 'captain')),
  status         text not null default 'open' check (status in ('open', 'sold', 'cancelled')),
  buyer_id       uuid references public.members (id) on delete set null,
  created_at     timestamptz not null default now(),
  closed_at      timestamptz,
  check (ask_shards is not null or ask_member_id is not null)
);
-- Une seule annonce ouverte par carte et par vendeur.
create unique index game_listings_one_open on public.game_listings (seller_id, member_id, team_id, kind) where status = 'open';

create table public.game_offers (
  id           uuid primary key default gen_random_uuid(),
  listing_id   uuid not null references public.game_listings (id) on delete cascade,
  buyer_id     uuid not null references public.members (id) on delete cascade,
  shards       integer not null default 0 check (shards >= 0),
  cards        jsonb not null default '[]',
  status       text not null default 'pending' check (status in ('pending', 'accepted', 'refused', 'cancelled')),
  created_at   timestamptz not null default now(),
  decided_at   timestamptz
);
create index on public.game_offers (listing_id);

alter table public.game_listings enable row level security;
alter table public.game_offers enable row level security;
revoke all on public.game_listings, public.game_offers from anon;
create policy "joueurs VUT" on public.game_listings for select to authenticated using (public.is_board());
create policy "acheteur ou vendeur" on public.game_offers for select to authenticated
  using (buyer_id = public.current_member_id()
    or exists (select 1 from public.game_listings l where l.id = listing_id and l.seller_id = public.current_member_id()));

-- Déplace un exemplaire d'une carte d'un joueur à l'autre (erreur si le donneur ne l'a pas).
create function public.game_move_card(p_from uuid, p_to uuid, p_member uuid, p_team uuid, p_kind text) returns void
language plpgsql security definer set search_path = public as $$
declare v_pos text;
begin
  if p_kind = 'legend' then raise exception 'VUT:legend'; end if;
  -- Dernier exemplaire : la ligne part ; sinon un exemplaire de moins (copies reste > 0).
  delete from public.game_collection
  where owner_id = p_from and member_id = p_member and team_id is not distinct from p_team and kind = p_kind and copies = 1
  returning position into v_pos;
  if not found then
    update public.game_collection set copies = copies - 1
    where owner_id = p_from and member_id = p_member and team_id is not distinct from p_team and kind = p_kind and copies > 1
    returning position into v_pos;
    if not found then raise exception 'VUT:missing_card'; end if;
  end if;
  insert into public.game_collection (owner_id, member_id, team_id, kind, copies, position)
  values (p_to, p_member, p_team, p_kind, 1, v_pos)
  on conflict on constraint game_collection_card
  do update set copies = public.game_collection.copies + 1, position = coalesce(public.game_collection.position, excluded.position);
end $$;

-- Échange complet en une seule transaction : carte de l'annonce → acheteur ; éclats et cartes de
-- l'acheteur → vendeur ; annonce vendue. Toute erreur annule tout.
create function public.game_trade(p_listing uuid, p_buyer uuid, p_shards integer, p_cards jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare l public.game_listings; c jsonb;
begin
  select * into l from public.game_listings where id = p_listing for update;
  if not found or l.status <> 'open' then raise exception 'VUT:closed'; end if;
  if l.seller_id = p_buyer then raise exception 'VUT:self'; end if;
  perform public.game_move_card(l.seller_id, p_buyer, l.member_id, l.team_id, l.kind);
  if p_shards > 0 then
    update public.game_wallet set shards = shards - p_shards where owner_id = p_buyer and shards >= p_shards;
    if not found then raise exception 'VUT:shards'; end if;
    insert into public.game_wallet (owner_id, shards) values (l.seller_id, p_shards)
    on conflict (owner_id) do update set shards = public.game_wallet.shards + excluded.shards;
  end if;
  for c in select * from jsonb_array_elements(coalesce(p_cards, '[]'::jsonb)) loop
    perform public.game_move_card(p_buyer, l.seller_id, (c->>'memberId')::uuid, nullif(c->>'teamId', '')::uuid, c->>'kind');
  end loop;
  update public.game_listings set status = 'sold', buyer_id = p_buyer, closed_at = now() where id = p_listing;
  update public.game_offers set status = 'refused', decided_at = now() where listing_id = p_listing and status = 'pending' and buyer_id <> p_buyer;
end $$;
revoke all on function public.game_move_card(uuid, uuid, uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.game_trade(uuid, uuid, integer, jsonb) from public, anon, authenticated;
