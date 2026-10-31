-- VUT : poste figé.
-- 1) Compo : le poste de chaque carte est enregistré à la validation ; les points se calculent
--    avec ce poste, même si le joueur change de poste ensuite (null = anciennes compos : poste actuel).
-- 2) Collection : le poste d'une carte obtenue est gardé ; une rare reste à son propriétaire même si
--    le joueur retire son poste 2.
alter table public.game_lineups add column position text;
alter table public.game_collection add column position text;

create or replace function public.game_add_cards(p_owner uuid, p_cards jsonb, p_gifted boolean default false) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.game_collection (owner_id, member_id, team_id, kind, copies, gifted, position)
  select p_owner, (c->>'memberId')::uuid, nullif(c->>'teamId', '')::uuid, coalesce(c->>'kind', 'common'), count(*)::smallint, p_gifted,
         max(c->>'position')
  from jsonb_array_elements(p_cards) c
  group by 2, 3, 4
  on conflict on constraint game_collection_card
  do update set copies = public.game_collection.copies + excluded.copies,
                position = coalesce(excluded.position, public.game_collection.position);
end $$;
revoke all on function public.game_add_cards(uuid, jsonb, boolean) from public, anon, authenticated;
