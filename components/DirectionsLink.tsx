/** Lien « Itinéraire » vers Google Maps (nouvel onglet ou appli Maps). */
export function DirectionsLink({ url }: { url: string | null }) {
  if (!url) return null;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="directions-link" aria-label="Itinéraire vers le gymnase (Google Maps)">
      Itinéraire ↗
    </a>
  );
}
