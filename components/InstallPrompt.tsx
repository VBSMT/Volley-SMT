"use client";

import { useEffect, useState } from "react";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const DISMISS_KEY = "install-prompt-dismissed";

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

/** Encart « Installer l'appli » sur l'accueil : bouton (Android, Chrome) ou étapes (iPhone, iPad). */
export function InstallPrompt() {
  const [mode, setMode] = useState<"none" | "ios" | "button">("none");
  const [event, setEvent] = useState<InstallEvent>();

  useEffect(() => {
    if (isStandalone()) return;
    try {
      if (localStorage.getItem(DISMISS_KEY)) return;
    } catch {}
    // iPad récent : se présente comme un Mac, mais tactile.
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (/macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
    if (ios) setMode("ios");
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as InstallEvent);
      setMode("button");
    };
    const onInstalled = () => setMode("none");
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (mode === "none") return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {}
    setMode("none");
  };

  return (
    <section className="notice stack install-prompt" aria-labelledby="install-title" data-tour="install">
      <h2 id="install-title">Installer l&apos;appli</h2>
      {mode === "ios" ? (
        <ol className="small">
          <li>Dans Safari, touchez <strong>Partager</strong> (carré avec une flèche vers le haut).</li>
          <li>Choisissez <strong>« Sur l&apos;écran d&apos;accueil »</strong>, puis <strong>Ajouter</strong>.</li>
          <li>Ouvrez Volley SMT depuis l&apos;icône pour recevoir les notifications.</li>
        </ol>
      ) : (
        <>
          <p className="small">Ajoutez Volley SMT à l&apos;écran d&apos;accueil : plein écran et notifications.</p>
          <button
            type="button"
            className="btn-primary"
            onClick={async () => {
              await event?.prompt();
              const choice = await event?.userChoice;
              if (choice?.outcome === "accepted") setMode("none");
            }}
          >
            Installer
          </button>
        </>
      )}
      <button type="button" className="btn-secondary" onClick={dismiss}>
        Plus tard
      </button>
    </section>
  );
}
