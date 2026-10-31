-- Annonces : une annonce désactivée n'apparaît plus sur l'accueil mais reste dans l'historique.
alter table public.announcements add column active boolean not null default true;
