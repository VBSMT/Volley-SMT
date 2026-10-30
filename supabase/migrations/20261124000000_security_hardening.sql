-- Audit de sécurité (octobre 2026).
-- 1) VUT : éclats et exemplaires modifiés en une seule opération (pas de relecture puis réécriture),
--    pour qu'une ouverture et un échange simultanés ne puissent pas annuler une dépense.
-- 2) Limites de taille et adresse des liens vérifiées aussi en base (pas seulement par l'appli).

-- Ajoute (ou retire, n négatif) des éclats ; refuse un solde négatif. Renvoie le nouveau solde, ou null.
create function public.game_add_shards(p_owner uuid, p_n integer) returns integer
language plpgsql security definer set search_path = public as $$
declare v integer;
begin
  if p_n >= 0 then
    insert into public.game_wallet (owner_id, shards) values (p_owner, p_n)
    on conflict (owner_id) do update set shards = public.game_wallet.shards + excluded.shards
    returning shards into v;
  else
    update public.game_wallet set shards = shards + p_n
    where owner_id = p_owner and shards + p_n >= 0
    returning shards into v;
  end if;
  return v;
end $$;

-- Ajoute des cartes à une collection : un doublon augmente le nombre d'exemplaires.
-- `p_gifted` marque seulement une carte obtenue pour la première fois (mention « Cadeau »).
create function public.game_add_cards(p_owner uuid, p_cards jsonb, p_gifted boolean default false) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into public.game_collection (owner_id, member_id, team_id, kind, copies, gifted)
  select p_owner, (c->>'memberId')::uuid, nullif(c->>'teamId', '')::uuid, coalesce(c->>'kind', 'common'), count(*)::smallint, p_gifted
  from jsonb_array_elements(p_cards) c
  group by 2, 3, 4
  on conflict on constraint game_collection_card
  do update set copies = public.game_collection.copies + excluded.copies;
end $$;

-- Réservées au serveur (clé service_role) : jamais appelables par un adhérent.
revoke all on function public.game_add_shards(uuid, integer) from public, anon, authenticated;
revoke all on function public.game_add_cards(uuid, jsonb, boolean) from public, anon, authenticated;

-- Limites alignées sur l'appli (marge comprise). `not valid` : n'échoue pas sur d'éventuelles
-- anciennes lignes, mais s'applique à toute nouvelle écriture.
alter table public.reschedule_requests add constraint reschedule_note_len check (char_length(note) <= 300) not valid;
alter table public.reschedule_events add constraint reschedule_event_note_len check (char_length(note) <= 300) not valid;
alter table public.events
  add constraint events_title_len check (char_length(title) <= 120) not valid,
  add constraint events_location_len check (char_length(location) <= 120) not valid,
  add constraint events_description_len check (char_length(description) <= 4000) not valid;
alter table public.announcements
  add constraint announcements_title_len check (char_length(title) <= 120) not valid,
  add constraint announcements_body_len check (char_length(body) <= 4000) not valid;
alter table public.useful_links
  add constraint useful_links_label_len check (char_length(label) <= 80) not valid,
  add constraint useful_links_url_http check (url ~* '^https?://\S+$' and char_length(url) <= 500) not valid;
