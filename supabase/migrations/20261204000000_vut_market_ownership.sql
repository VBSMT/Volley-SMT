-- VUT marché : une annonce n'existe que pour une carte réellement possédée.
-- 1) Contrôle en base à la création (même si le serveur se trompait).
create function public.game_listing_owned() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.game_collection c
    where c.owner_id = new.seller_id and c.member_id = new.member_id and c.team_id is not distinct from new.team_id and c.kind = new.kind
  ) then
    raise exception 'VUT:missing_card';
  end if;
  return new;
end $$;
create trigger game_listing_owned before insert on public.game_listings
  for each row execute function public.game_listing_owned();

-- 2) Après un échange, les annonces ouvertes dont le vendeur n'a plus la carte sont retirées.
create function public.game_close_orphan_listings() returns void
language sql security definer set search_path = public as $$
  update public.game_listings l set status = 'cancelled', closed_at = now()
  where l.status = 'open' and not exists (
    select 1 from public.game_collection c
    where c.owner_id = l.seller_id and c.member_id = l.member_id and c.team_id is not distinct from l.team_id and c.kind = l.kind
  );
$$;
revoke all on function public.game_close_orphan_listings() from public, anon, authenticated;

create or replace function public.game_trade(p_listing uuid, p_buyer uuid, p_shards integer, p_cards jsonb) returns void
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
  perform public.game_close_orphan_listings();
end $$;
revoke all on function public.game_trade(uuid, uuid, integer, jsonb) from public, anon, authenticated;

-- 3) Annonces déjà ouvertes sans carte derrière : retirées tout de suite.
select public.game_close_orphan_listings();
