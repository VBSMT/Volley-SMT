-- =============================================================================
-- Postes d'un joueur modifiables par le capitaine de son équipe (ou le Bureau).
-- Fonction dédiée : le capitaine ne peut toucher QUE les deux postes, rien d'autre de la fiche.
-- Rollback : supabase/rollbacks/20261111000000_set_member_positions.down.sql
-- =============================================================================

create function public.set_member_positions(
  target uuid,
  p1 public.court_position,
  p2 public.court_position
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (
    public.is_board()
    or exists (
      select 1 from public.member_teams mt
      where mt.member_id = target and public.is_captain_of(mt.team_id)
    )
  ) then
    raise exception 'Réservé au capitaine de l''équipe ou au Bureau' using errcode = '42501';
  end if;
  update public.members
     set position_1 = p1,
         position_2 = case when p2 is distinct from p1 then p2 end
   where id = target;
end $$;

revoke all on function public.set_member_positions(uuid, public.court_position, public.court_position) from public, anon;
grant execute on function public.set_member_positions(uuid, public.court_position, public.court_position) to authenticated;
