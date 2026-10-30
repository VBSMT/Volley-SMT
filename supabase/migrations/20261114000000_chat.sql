-- =============================================================================
-- Messagerie éphémère : salons Club, chaque équipe, Bureau, Capitaines. Messages gardés 7 jours.
-- Salon (room) : 'club' | 'board' | 'captains' | 'team:<uuid>'.
-- Rollback : supabase/rollbacks/20261114000000_chat.down.sql
-- =============================================================================

create table public.chat_messages (
  id          uuid primary key default gen_random_uuid(),
  room        text not null check (room ~ '^(club|board|captains|team:[0-9a-f-]{36})$'),
  author_id   uuid references public.members (id) on delete set null,
  body        text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at  timestamptz not null default now()
);
create index on public.chat_messages (room, created_at desc);

-- Préférences par salon : notification (désactivée par défaut) et dernier passage (messages non lus).
create table public.chat_room_prefs (
  member_id    uuid not null references public.members (id) on delete cascade,
  room         text not null,
  notify       boolean not null default false,
  last_read_at timestamptz,
  primary key (member_id, room)
);

-- Notification quand on est cité (@Prénom N.) : désactivée par défaut.
alter table public.members add column notify_mentions boolean not null default false;

-- Accès à un salon.
create function public.can_access_room(r text) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when r = 'club' then public.is_member()
    when r = 'board' then public.is_board()
    when r = 'captains' then public.has_role('captain') or public.is_board()
    when r like 'team:%' then public.in_team(substr(r, 6)::uuid) or public.is_board()
    else false
  end
$$;

alter table public.chat_messages   enable row level security;
alter table public.chat_room_prefs enable row level security;
revoke all on public.chat_messages, public.chat_room_prefs from anon;

create policy "lire les salons accessibles" on public.chat_messages for select to authenticated
  using (public.can_access_room(room));
create policy "écrire en son nom" on public.chat_messages for insert to authenticated
  with check (author_id = public.current_member_id() and public.can_access_room(room));
create policy "supprimer le sien ou Bureau" on public.chat_messages for delete to authenticated
  using (author_id = public.current_member_id() or public.is_board());

create policy "ses préférences" on public.chat_room_prefs for all to authenticated
  using (member_id = public.current_member_id())
  with check (member_id = public.current_member_id() and public.can_access_room(room));

-- Messages non lus par salon (droits appliqués : security invoker).
create function public.chat_unread() returns table (room text, unread bigint)
language sql stable security invoker set search_path = public as $$
  select m.room, count(*)
  from public.chat_messages m
  left join public.chat_room_prefs p on p.room = m.room and p.member_id = public.current_member_id()
  where m.created_at > coalesce(p.last_read_at, '-infinity'::timestamptz)
    and m.author_id is distinct from public.current_member_id()
  group by m.room
$$;
grant execute on function public.chat_unread() to authenticated;

-- Temps réel (Supabase Realtime applique la RLS de lecture).
alter publication supabase_realtime add table public.chat_messages;
