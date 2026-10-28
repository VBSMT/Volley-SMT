-- Annule la migration initiale (à exécuter manuellement, en local uniquement).
drop trigger if exists on_auth_user_created on auth.users;
drop view if exists public.member_directory;
drop table if exists
  public.sync_runs, public.app_settings, public.useful_links, public.announcements,
  public.event_volunteer_signups, public.event_volunteer_needs, public.event_attendance, public.events,
  public.reschedule_events, public.reschedule_requests, public.matches,
  public.lineups, public.attendance, public.training_sessions,
  public.push_subscriptions, public.volunteer_requests, public.member_levels,
  public.member_roles, public.members, public.teams, public.seasons cascade;
drop function if exists
  public.reschedule_log(), public.reschedule_guard(), public.members_guard_update(),
  public.link_auth_user(), public.is_captain_of(uuid), public.is_member(),
  public.is_board(), public.has_role(public.app_role), public.current_member_id();
drop type if exists
  public.match_source, public.announcement_target, public.event_type,
  public.reschedule_status, public.request_status, public.court_position,
  public.sex, public.app_role;
