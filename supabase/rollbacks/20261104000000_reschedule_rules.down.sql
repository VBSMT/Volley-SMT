drop policy if exists "capitaine de l'équipe" on public.reschedule_events;
drop policy "capitaine demande" on public.reschedule_requests;
create policy "capitaine demande" on public.reschedule_requests for insert to authenticated
  with check (requested_by = public.current_member_id() and exists (
    select 1 from public.matches m where m.id = match_id and public.is_captain_of(m.team_id)));
drop index if exists public.reschedule_requests_one_active;
