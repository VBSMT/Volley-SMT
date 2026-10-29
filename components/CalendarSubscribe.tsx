"use client";

import { useEffect, useState } from "react";

/**
 * Abonnement agenda aux matchs d'une équipe : flux servi par l'appli (/api/calendrier/CODE.ics),
 * à jour après chaque synchro volley34 (reports compris).
 */
export function CalendarSubscribe({ code, teamName }: { code: string; teamName: string }) {
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => setOrigin(window.location.origin), []);
  if (!origin) return null;

  const https = `${origin}/api/calendrier/${encodeURIComponent(code)}.ics`;
  const webcal = https.replace(/^https?:/, "webcal:");
  const google = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`;

  return (
    <details className="calendar-subscribe">
      <summary>Ajouter les matchs de {teamName} à mon agenda</summary>
      <div className="stack">
        <a href={google} target="_blank" rel="noopener noreferrer" className="btn-secondary center">
          Google Agenda (Android) ↗
        </a>
        <a href={webcal} className="btn-secondary center">
          iPhone, Mac, Outlook ↗
        </a>
        <p className="muted small">
          Android : après l&apos;ajout, ouvrez l&apos;appli Google Agenda › Paramètres › « Volley SMT · {teamName} »
          et activez <strong>Synchronisation</strong>, sinon les matchs n&apos;apparaissent pas sur le téléphone.
          Les reports se mettent à jour tout seuls (Google peut mettre quelques heures).
        </p>
        <button
          type="button"
          className="btn-secondary"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(https);
              setCopied(true);
              setTimeout(() => setCopied(false), 3000);
            } catch {
              window.prompt("Copiez ce lien :", https);
            }
          }}
        >
          {copied ? "Lien copié ✓" : "Copier le lien du calendrier"}
        </button>
      </div>
    </details>
  );
}
