-- =============================================================================
-- Événements : visibilité par rôle (vide = tous les adhérents ; le Bureau voit tout),
-- appliquée à l'événement, à ses sondages et aux réponses.
-- Rollback : supabase/rollbacks/20261105000000_event_visibility.down.sql
-- =============================================================================

alter table public.events add column visible_roles public.app_role[] not null default '{}';

-- L'adhérent connecté peut-il voir cet événement ?
create function public.can_see_event(e uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_board() or exists (
    select 1 from public.events ev
    where ev.id = e and public.is_member() and (
      cardinality(ev.visible_roles) = 0
      or exists (
        select 1 from public.member_roles mr join public.members m on m.id = mr.member_id
        where m.user_id = auth.uid() and mr.role = any (ev.visible_roles)
      )
    )
  )
$$;

-- Événements
drop policy "lecture adhérents" on public.events;
create policy "visibles selon les rôles" on public.events for select to authenticated
  using (public.can_see_event(id));

-- Présence adhérents
drop policy "lecture adhérents" on public.event_attendance;
drop policy "répondre pour soi" on public.event_attendance;
create policy "visibles selon l'événement" on public.event_attendance for select to authenticated
  using (public.can_see_event(event_id));
create policy "répondre pour soi" on public.event_attendance for all to authenticated
  using (member_id = public.current_member_id())
  with check (
    member_id = public.current_member_id()
    and public.can_see_event(event_id)
    and exists (select 1 from public.events e where e.id = event_id and e.attendance_poll and e.starts_at > now())
  );

-- Participation bénévole (bénévoles et Bureau)
drop policy "lecture bénévoles" on public.event_volunteer_needs;
create policy "lecture bénévoles" on public.event_volunteer_needs for select to authenticated
  using ((public.has_role('volunteer') or public.is_board()) and public.can_see_event(event_id));
drop policy "lecture bénévoles" on public.event_volunteer_signups;
drop policy "répondre pour soi" on public.event_volunteer_signups;
create policy "lecture bénévoles" on public.event_volunteer_signups for select to authenticated
  using ((public.has_role('volunteer') or public.is_board()) and public.can_see_event(event_id));
create policy "répondre pour soi" on public.event_volunteer_signups for all to authenticated
  using (member_id = public.current_member_id())
  with check (
    member_id = public.current_member_id()
    and (public.has_role('volunteer') or public.is_board())
    and public.can_see_event(event_id)
    and exists (select 1 from public.events e where e.id = event_id and e.volunteer_poll and e.starts_at > now())
  );
