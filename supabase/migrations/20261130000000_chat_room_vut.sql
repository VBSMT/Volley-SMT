-- Messagerie : salon « VUT », ouvert à tous les adhérents (comme « Tout le club »).
create or replace function public.can_access_room(r text) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when r in ('club', 'vut') then public.is_member()
    when r = 'board' then public.is_board()
    when r = 'captains' then public.has_role('captain') or public.is_board()
    when r = 'volunteers' then public.has_role('volunteer') or public.is_board()
    when r like 'team:%' then public.in_team(substr(r, 6)::uuid)
    else false
  end
$$;

alter table public.chat_messages drop constraint chat_messages_room_check;
alter table public.chat_messages
  add constraint chat_messages_room_check check (room ~ '^(club|vut|board|captains|volunteers|team:[0-9a-f-]{36})$');
