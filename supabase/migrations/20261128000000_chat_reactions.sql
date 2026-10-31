-- Messagerie : réactions (5 emojis), visibles et possibles seulement dans les salons accessibles.
create table public.chat_reactions (
  message_id  uuid not null references public.chat_messages (id) on delete cascade,
  member_id   uuid not null references public.members (id) on delete cascade,
  emoji       text not null check (emoji in ('👍', '👎', '❤️', '😂', '🏐')),
  created_at  timestamptz not null default now(),
  primary key (message_id, member_id, emoji)
);
create index on public.chat_reactions (message_id);

alter table public.chat_reactions enable row level security;
revoke all on public.chat_reactions from anon;
create policy "salons accessibles" on public.chat_reactions for select to authenticated
  using (exists (select 1 from public.chat_messages m where m.id = message_id and public.can_access_room(m.room)));
create policy "réagir en son nom" on public.chat_reactions for insert to authenticated
  with check (member_id = public.current_member_id()
    and exists (select 1 from public.chat_messages m where m.id = message_id and public.can_access_room(m.room)));
create policy "retirer sa réaction" on public.chat_reactions for delete to authenticated
  using (member_id = public.current_member_id());

alter publication supabase_realtime add table public.chat_reactions;
