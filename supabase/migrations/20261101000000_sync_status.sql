-- =============================================================================
-- Date de la dernière synchro volley34 réussie, lisible par tout adhérent
-- (bandeau « non mis à jour depuis le … »). Le détail de sync_runs reste Bureau.
-- Rollback : supabase/rollbacks/20261101000000_sync_status.down.sql
-- =============================================================================
create view public.last_successful_sync with (security_invoker = false) as
  select max(finished_at) as finished_at
  from public.sync_runs
  where success and source = 'volley34' and public.is_member();

revoke all on public.last_successful_sync from anon;
grant select on public.last_successful_sync to authenticated;
