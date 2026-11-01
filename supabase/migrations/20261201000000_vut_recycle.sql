-- VUT : les doublons sont gardés (plus d'éclat automatique) ; « Recycler » transforme un exemplaire
-- en trop en 1 éclat, en une seule opération. Réservée au serveur.
create function public.game_recycle(p_owner uuid, p_member uuid, p_team uuid, p_kind text) returns integer
language plpgsql security definer set search_path = public as $$
declare v integer;
begin
  update public.game_collection set copies = copies - 1
  where owner_id = p_owner and member_id = p_member and team_id is not distinct from p_team and kind = p_kind and copies > 1;
  if not found then return null; end if;
  insert into public.game_wallet (owner_id, shards) values (p_owner, 1)
  on conflict (owner_id) do update set shards = public.game_wallet.shards + 1
  returning shards into v;
  return v;
end $$;
revoke all on function public.game_recycle(uuid, uuid, uuid, text) from public, anon, authenticated;

-- Préférence « Jeu VUT » (boosters gagnés, cadeaux, changements de poste), activée par défaut.
alter table public.members add column notify_game boolean not null default true;
