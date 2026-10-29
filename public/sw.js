// Service worker Volley SMT : réception des notifications push, même appli fermée.

// Hors ligne : les dernières versions consultées des pages adhérent restent lisibles sans réseau
// (au gymnase, en déplacement). Jamais les pages Bureau (niveaux, compo). Cache vidé à la déconnexion.
const PAGES = "pages-v1";
const STATIC = "static-v1";
const OFFLINE_PAGES = ["/accueil", "/entrainements", "/matchs", "/stats", "/evenements", "/annonces", "/liens", "/aide"];

const cacheable = (url) => OFFLINE_PAGES.some((p) => url.pathname === p || url.pathname.startsWith(`${p}/`));

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => ![PAGES, STATIC].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  ),
);

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Déconnexion : plus aucune donnée personnelle en cache.
  if (request.method === "POST" && url.pathname === "/auth/deconnexion") {
    event.waitUntil(caches.delete(PAGES));
    return;
  }
  if (request.method !== "GET") return;

  // Fichiers de l'appli (versionnés par Next) : cache d'abord.
  if (url.pathname.startsWith("/_next/static/") || /\.(png|svg|woff2?)$/.test(url.pathname)) {
    event.respondWith(
      caches.open(STATIC).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const res = await fetch(request);
        if (res.ok) cache.put(request, res.clone());
        return res;
      }),
    );
    return;
  }

  // Pages : réseau d'abord, dernière version enregistrée si pas de réseau.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        const cache = await caches.open(PAGES);
        try {
          const res = await fetch(request);
          const final = new URL(res.url || request.url);
          if (final.pathname === "/connexion") await caches.delete(PAGES); // session expirée
          else if (res.ok && cacheable(url) && !res.redirected) cache.put(request, res.clone());
          return res;
        } catch {
          const hit = (await cache.match(request)) ?? (await cache.match(url.pathname, { ignoreSearch: true }));
          if (hit) return hit;
          return (
            (await cache.match("/accueil")) ??
            new Response(
              "<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width'><title>Hors ligne</title>" +
                "<body style='font-family:sans-serif;padding:24px;background:#111;color:#fff'><h1>Pas de réseau</h1>" +
                "<p>Cette page n'a pas encore été consultée sur cet appareil. Réessayez une fois connecté.</p></body>",
              { headers: { "Content-Type": "text/html; charset=utf-8" }, status: 503 },
            )
          );
        }
      })(),
    );
  }
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Volley SMT", body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Volley SMT", {
      body: data.body || "",
      icon: "/icon-192.png",
      data: { url: data.url || "/accueil" },
      lang: "fr",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/accueil", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      for (const w of windows) {
        if (w.url.startsWith(self.location.origin) && "focus" in w) {
          w.navigate(url);
          return w.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
