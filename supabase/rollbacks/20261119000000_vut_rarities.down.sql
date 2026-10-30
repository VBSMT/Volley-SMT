delete from public.game_lineups where kind <> 'common' or team_id is null;
delete from public.game_collection where kind <> 'common' or team_id is null;
alter table public.game_lineups drop constraint game_lineups_slot_check;
alter table public.game_lineups add constraint game_lineups_slot_check check (slot in ('setter', 'front_left', 'front_right', 'back', 'sub'));
alter table public.game_lineups alter column team_id set not null;
alter table public.game_lineups drop column kind;
alter table public.game_collection drop constraint game_collection_card;
alter table public.game_collection alter column team_id set not null;
alter table public.game_collection drop column kind;
alter table public.game_collection add primary key (owner_id, member_id, team_id);
drop table public.game_legends;
-- Puis recréer la vue game_cards de 20261117000000_game.sql (communes, réservée au Bureau).
