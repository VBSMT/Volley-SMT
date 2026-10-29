"use client";

import { useState, useTransition } from "react";
import { requestReschedule, updateReschedule } from "@/app/(app)/matchs/reschedule-actions";
import { useConfirm, useToast } from "@/components/Feedback";
import type { RescheduleStatus } from "@/lib/domain/reschedule";

const CONFIRM: Partial<Record<RescheduleStatus, { title: string; text: string; done: string }>> = {
  approved: { title: "Valider ce report ?", text: "Le créneau sera pré-réservé et le capitaine prévenu.", done: "Report validé." },
  rejected: { title: "Refuser ce report ?", text: "Le capitaine sera prévenu.", done: "Report refusé." },
  abandoned: { title: "Abandonner ce report ?", text: "Le créneau sera libéré.", done: "Report abandonné." },
};

const LABELS: Partial<Record<RescheduleStatus, string>> = {
  approved: "Valider (pré-réserver)",
  rejected: "Refuser",
  abandoned: "Abandonner",
};

export function RescheduleButtons({ requestId, next }: { requestId: string; next: RescheduleStatus[] }) {
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  if (!next.length) return null;
  return (
    <div className="stack">
      {dialog}
      <div className="action-row">
        {next.map((to) => (
          <button
            key={to}
            type="button"
            className={to === "approved" ? "poll-btn yes" : "poll-btn"}
            disabled={pending}
            onClick={async () => {
              const c = CONFIRM[to]!;
              if (!(await confirm(c.title, { text: c.text }))) return;
              startTransition(async () => {
                const r = await updateReschedule(requestId, to);
                setError(r.error);
                // Une décision du Bureau reste modifiable ensuite ; l'abandon est définitif.
                if (!r.error) toast({ message: to === "abandoned" ? c.done : `${c.done} Modifiable tant que le report n'est pas confirmé.` });
              });
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
  const toast = useToast();
  const { confirm, dialog } = useConfirm();

  if (!slots.length) return <p className="muted small">Aucun créneau libre à venir pour l&apos;instant.</p>;
  return (
    <form
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        const label = slots.find((s) => s.id === slot)?.label;
        if (!(await confirm("Envoyer la demande de report ?", { text: `Créneau : ${label}. Le Bureau sera prévenu.`, confirmLabel: "Envoyer" }))) return;
        startTransition(async () => {
          const r = await requestReschedule(matchId, slot, note);
          setError(r.error);
          if (r.id) toast({ message: "Demande de report envoyée au Bureau.", undo: () => updateReschedule(r.id!, "abandoned") });
        });
      }}
    >
      {dialog}
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
