/**
 * Adresses d'abonnement push acceptées : uniquement les services des navigateurs.
 * Évite que le serveur envoie des requêtes vers une adresse arbitraire fournie par un client.
 */
const PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/, // Chrome, Edge (Android), Brave…
  /^updates\.push\.services\.mozilla\.com$/, // Firefox
  /^web\.push\.apple\.com$/, // Safari / iPhone
  /\.push\.apple\.com$/,
  /\.notify\.windows\.com$/, // Edge (Windows)
];

export function isAllowedPushEndpoint(endpoint: string | undefined | null): boolean {
  if (!endpoint) return false;
  try {
    const url = new URL(endpoint);
    return url.protocol === "https:" && !url.port && PUSH_HOSTS.some((h) => h.test(url.hostname));
  } catch {
    return false;
  }
}
