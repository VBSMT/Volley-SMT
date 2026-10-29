drop policy if exists "répondre pour soi" on public.event_volunteer_signups;
drop policy if exists "lecture bénévoles" on public.event_volunteer_signups;
create policy "lecture bénévoles" on public.event_volunteer_signups for select to authenticated
  using (public.has_role('volunteer') or public.is_board());
create policy "répondre pour soi" on public.event_volunteer_signups for all to authenticated
  using (member_id = public.current_member_id())
  with check (member_id = public.current_member_id() and public.has_role('volunteer')
    and exists (select 1 from public.events e where e.id = event_id and e.volunteer_poll));
drop policy if exists "lecture bénévoles" on public.event_volunteer_needs;
create policy "lecture bénévoles" on public.event_volunteer_needs for select to authenticated
  using (public.has_role('volunteer') or public.is_board());
drop policy if exists "répondre pour soi" on public.event_attendance;
drop policy if exists "visibles selon l'événement" on public.event_attendance;
create policy "lecture adhérents" on public.event_attendance for select to authenticated using (public.is_member());
create policy "répondre pour soi" on public.event_attendance for all to authenticated
  using (member_id = public.current_member_id())
  with check (member_id = public.current_member_id()
    and exists (select 1 from public.events e where e.id = event_id and e.attendance_poll));
drop policy if exists "visibles selon les rôles" on public.events;
create policy "lecture adhérents" on public.events for select to authenticated using (public.is_member());
drop function if exists public.can_see_event(uuid);
alter table public.events drop column if exists visible_roles;
