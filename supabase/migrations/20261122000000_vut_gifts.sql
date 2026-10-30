-- VUT : cadeaux du maître du jeu (boosters et cartes précises).
-- Un booster cadeau porte ses cartes choisies d'avance (gift_cards) et un message facultatif ;
-- une carte reçue en cadeau est marquée dans la collection (mention « Cadeau » dans l'album).
alter table public.game_boosters add column gift_cards jsonb, add column message text;
alter table public.game_collection add column gifted boolean not null default false;
