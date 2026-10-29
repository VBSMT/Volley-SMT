"use client";

import { useState } from "react";

/**
 * Abonnement au calendrier officiel de l'équipe (flux volley34, mis à jour par volley34 :
 * dates et reports suivent automatiquement dans l'agenda du téléphone).
 */
export function CalendarSubscribe({ code, teamName }: { code: string; teamName: string }) {
  const [copied, setCopied] = useState(false);
  const https = `https://www.volley34.fr/icalendar.aspx?equipe=${encodeURIComponent(code)}`;
  const webcal = https.replace(/^https:/, "webcal:");

  return (
    <details className="calendar-subscribe">
      <summary>Ajouter les matchs de {teamName} à mon agenda</summary>
      <div className="stack">
        <a href={webcal} className="btn-secondary center">
          S&apos;abonner (iPhone, Mac, Outlook) ↗
        </a>
        <p className="muted small">
          Google Agenda (Android) : copiez le lien, puis sur ordinateur dans Google Agenda : Autres agendas ＋ ›
          « À partir de l&apos;URL ». Les reports se mettent à jour tout seuls.
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
