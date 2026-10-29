"use client";

import { useState, useTransition } from "react";
import { requestReschedule, updateReschedule } from "@/app/(app)/matchs/reschedule-actions";
import type { RescheduleStatus } from "@/lib/domain/reschedule";

const LABELS: Partial<Record<RescheduleStatus, string>> = {
  approved: "Valider (pré-réserver)",
  rejected: "Refuser",
  abandoned: "Abandonner",
};

export function RescheduleButtons({ requestId, next }: { requestId: string; next: RescheduleStatus[] }) {
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  if (!next.length) return null;
  return (
    <div className="stack">
      <div className="action-row">
        {next.map((to) => (
          <button
            key={to}
            type="button"
            className={to === "approved" ? "poll-btn yes" : "poll-btn"}
            disabled={pending}
            onClick={() => {
              if (to === "abandoned" && !confirm("Abandonner ce report ? Le créneau sera libéré.")) return;
              startTransition(async () => setError((await updateReschedule(requestId, to)).error));
            }}
          >
            {LABELS[to]}
          </button>
        ))}
      </div>
      {error && <p className="error small" role="alert">{error}</p>}
    </div>
  );
}

export function RescheduleRequestForm({ matchId, slots }: { matchId: string; slots: { id: string; label: string }[] }) {
  const [slot, setSlot] = useState(slots[0]?.id ?? "");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  if (!slots.length) return <p className="muted small">Aucun créneau libre à venir pour l&apos;instant.</p>;
  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => setError((await requestReschedule(matchId, slot, note)).error));
      }}
    >
      <label htmlFor="slot">Créneau souhaité (terrain libre)</label>
      <select id="slot" value={slot} onChange={(e) => setSlot(e.target.value)}>
        {slots.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </select>
      <label htmlFor="reschedule-note">Message au Bureau (facultatif)</label>
      <textarea id="reschedule-note" rows={2} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
      <p className="muted small">
        Le Bureau ne gère que le gymnase : la date reste à faire accepter par l&apos;adversaire et à
        saisir sur volley34. Sans confirmation à J-3, la pré-réservation est libérée.
      </p>
      {error && <p className="error small" role="alert">{error}</p>}
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Envoi…" : "Demander ce créneau"}
      </button>
    </form>
  );
}
