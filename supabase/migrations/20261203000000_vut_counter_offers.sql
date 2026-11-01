-- VUT : contre-offres. Le vendeur peut répondre à une offre par ses propres conditions (éclats et/ou
-- cartes que l'acheteur donnerait) ; l'acheteur accepte, refuse ou contre-propose. 3 allers-retours au plus.
alter table public.game_offers add column from_seller boolean not null default false;
alter table public.game_offers add column round smallint not null default 1 check (round between 1 and 3);
alter table public.game_offers drop constraint game_offers_status_check;
alter table public.game_offers add constraint game_offers_status_check check (status in ('pending', 'accepted', 'refused', 'cancelled', 'countered'));
