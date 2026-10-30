drop table if exists public.game_collection;
drop table if exists public.game_boosters;
drop view if exists public.game_cards;
drop table if exists public.game_team_form;
drop trigger if exists members_photo_consent on public.members;
drop function if exists public.members_photo_consent();
alter table public.members drop column if exists photo_updated_at;
-- Le bucket « photos » se vide puis se supprime depuis l'API Storage (pas en SQL).
