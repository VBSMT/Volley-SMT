-- Sondages : chacun peut retirer sa réponse (« je ne sais pas encore ») tant que le sondage est ouvert.
-- (Les réponses aux événements et au bénévolat sont déjà supprimables : politique « for all ».)
create policy "retirer sa réponse" on public.attendance for delete to authenticated
  using (member_id = public.current_member_id() and exists (
    select 1 from public.training_sessions s where s.id = session_id and s.poll_closed_at is null and s.starts_at > now()));
create policy "retirer sa réponse" on public.match_availability for delete to authenticated
  using (member_id = public.current_member_id()
    and exists (select 1 from public.matches x where x.id = match_id and x.starts_at > now()));
