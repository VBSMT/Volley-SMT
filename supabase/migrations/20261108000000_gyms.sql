-- =============================================================================
-- Gymnases volley34 (adresse, coordonnées GPS) : lien d'itinéraire des matchs à l'extérieur.
-- Rollback : supabase/rollbacks/20261108000000_gyms.down.sql
-- =============================================================================

create table public.gyms (
  code         text primary key,              -- GymnaseCode volley34
  name         text not null,
  full_name    text not null,                 -- « Nom (Ville) », tel qu'écrit dans le flux ICS
  address      text,
  postal_code  text,
  city         text,
  lat          double precision,
  lon          double precision,
  updated_at   timestamptz not null default now()
);

alter table public.gyms enable row level security;
revoke all on public.gyms from anon;
-- Données publiques de volley34 : lisibles par tout adhérent, écrites par la synchro (service_role).
create policy "lecture adhérents" on public.gyms for select to authenticated using (public.is_member());
