delete from public.chat_messages where room = 'volunteers';
alter table public.chat_messages drop constraint chat_messages_room_check;
alter table public.chat_messages
  add constraint chat_messages_room_check check (room ~ '^(club|board|captains|team:[0-9a-f-]{36})$');
create or replace function public.can_access_room(r text) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when r = 'club' then public.is_member()
    when r = 'board' then public.is_board()
    when r = 'captains' then public.has_role('captain') or public.is_board()
    when r like 'team:%' then public.in_team(substr(r, 6)::uuid) or public.is_board()
    else false
  end
$$;
