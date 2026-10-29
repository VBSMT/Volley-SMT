"use client";

import { useEffect, useState } from "react";
import { deletePushSubscription, savePushSubscription } from "@/app/(app)/notifications/actions";

type Status = "loading" | "unsupported" | "ios-install" | "denied" | "off" | "on";

const VAPID_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function urlBase64ToUint8Array(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

/**
 * Activation des notifications push. `compact` : bandeau d'accueil, masqué une fois activé.
 */
export function NotificationToggle({ compact = false }: { compact?: boolean }) {
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !VAPID_KEY) {
        return setStatus(isIos() && !isStandalone() ? "ios-install" : "unsupported");
      }
      if (Notification.permission === "denied") return setStatus("denied");
      const reg = await navigator.serviceWorker.register("/sw.js");
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        // Réenregistre l'abonnement (au cas où il a changé ou été réattribué).
        await savePushSubscription(sub.toJSON());
        setStatus("on");
      } else setStatus("off");
    })().catch(() => setStatus("unsupported"));
  }, []);

  async function enable() {
    setBusy(true);
    setError(undefined);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return setStatus(permission === "denied" ? "denied" : "off");
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_KEY),
      });
      const result = await savePushSubscription(sub.toJSON());
      if (result.error) setError(result.error);
      else setStatus("on");
    } catch {
      setError("Activation impossible sur cet appareil.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await deletePushSubscription(sub.endpoint);
      await sub.unsubscribe();
    }
    setStatus("off");
    setBusy(false);
  }

  if (status === "loading") return null;
  // Sur l'accueil, l'installation sur iPhone est expliquée par InstallPrompt.
  if (compact && (status === "on" || status === "unsupported" || status === "denied" || status === "ios-install")) return null;

  return (
    <div className={compact ? "notice stack" : "stack"}>
      {status === "on" && <p className="success">Notifications activées sur cet appareil.</p>}
      {status === "off" && (
        <p className={compact ? "" : "muted small"}>
          Recevez la veille de chaque entraînement la demande ou le rappel directement sur ce
          téléphone (sinon, par email).
        </p>
      )}
      {status === "ios-install" && (
        <p className="small">
          Sur iPhone : touchez Partager puis « Sur l&apos;écran d&apos;accueil », ouvrez Volley SMT
          depuis l&apos;icône, puis activez les notifications.
        </p>
      )}
      {status === "denied" && (
        <p className="small">
          Notifications bloquées pour Volley SMT : autorisez-les dans les réglages du téléphone.
          Vous recevrez les messages par email en attendant.
        </p>
      )}
      {status === "unsupported" && (
        <p className="muted small">Notifications non disponibles sur cet appareil : vous les recevrez par email.</p>
      )}
      {status === "off" && (
        <button type="button" className="btn-primary" onClick={enable} disabled={busy}>
          {busy ? "Activation…" : "Activer les notifications"}
        </button>
      )}
      {status === "on" && !compact && (
        <button type="button" className="btn-secondary" onClick={disable} disabled={busy}>
          Désactiver sur cet appareil
        </button>
      )}
      {error && <p className="error small" role="alert">{error}</p>}
    </div>
  );
}
