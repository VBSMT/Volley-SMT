"use client";

import { useEffect, useState } from "react";

/** Enregistre le service worker (notifications, hors ligne) et signale l'absence de réseau. */
export function ServiceWorker() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!offline) return null;
  return (
    <p className="offline-banner" role="status">
      Hors ligne : dernière version consultée affichée. Réponses et changements impossibles.
    </p>
  );
}
