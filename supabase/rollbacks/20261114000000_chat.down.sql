alter publication supabase_realtime drop table public.chat_messages;
drop function if exists public.chat_unread();
drop table if exists public.chat_room_prefs;
drop table if exists public.chat_messages;
drop function if exists public.can_access_room(text);
alter table public.members drop column if exists notify_mentions;
