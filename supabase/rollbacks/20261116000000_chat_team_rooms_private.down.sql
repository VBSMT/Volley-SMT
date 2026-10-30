create or replace function public.can_access_room(r text) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when r = 'club' then public.is_member()
    when r = 'board' then public.is_board()
    when r = 'captains' then public.has_role('captain') or public.is_board()
    when r = 'volunteers' then public.has_role('volunteer') or public.is_board()
    when r like 'team:%' then public.in_team(substr(r, 6)::uuid) or public.is_board()
    else false
  end
$$;
