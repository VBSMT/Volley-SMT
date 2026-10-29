-- =============================================================================
-- Reports : une seule demande active par match ; le capitaine ne demande que pour
-- un match à domicile à venir de son équipe (le Bureau ne gère que le gymnase).
-- Rollback : supabase/rollbacks/20261104000000_reschedule_rules.down.sql
-- =============================================================================

create unique index reschedule_requests_one_active
  on public.reschedule_requests (match_id)
  where status in ('requested', 'approved');

drop policy "capitaine demande" on public.reschedule_requests;
create policy "capitaine demande" on public.reschedule_requests for insert to authenticated
  with check (
    requested_by = public.current_member_id()
    and exists (
      select 1 from public.matches m
      where m.id = match_id and m.is_home and m.starts_at > now() and public.is_captain_of(m.team_id)
    )
  );

-- Le journal est lisible par le capitaine de l'équipe concernée (en plus du Bureau).
create policy "capitaine de l'équipe" on public.reschedule_events for select to authenticated
  using (exists (
    select 1 from public.reschedule_requests r join public.matches m on m.id = r.match_id
    where r.id = request_id and public.is_captain_of(m.team_id)
  ));
