/** Affiché immédiatement au changement d'onglet, pendant le chargement de la page. */
export default function Loading() {
  return (
    <main className="page stack" aria-busy="true" aria-label="Chargement">
      <div className="skeleton skeleton-title" />
      <div className="skeleton skeleton-card" />
      <div className="skeleton skeleton-card" />
    </main>
  );
}
