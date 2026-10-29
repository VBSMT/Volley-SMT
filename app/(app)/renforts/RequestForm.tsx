"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useConfirm, useToast } from "@/components/Feedback";
import { POSITION_LABELS, REINFORCEMENT_POSITIONS } from "@/lib/member-types";
import { closeReinforcement, createReinforcement } from "./actions";

export function RequestForm({
  matches,
  defaultMatchId,
}: {
  matches: { id: string; label: string }[];
  defaultMatchId?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="card stack"
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const label = matches.find((m) => m.id === fd.get("match_id"))?.label;
        const ok = await confirm("Publier la demande de renfort ?", {
          text: `${label ?? ""}. Les adhérents concernés seront notifiés.`,
          confirmLabel: "Publier",
        });
        if (!ok) return;
        startTransition(async () => {
          const r = await createReinforcement({ status: "idle" }, fd);
          if (r.status !== "ok") return setError(r.message);
          toast({
            message: "Demande de renfort publiée.",
            undo: () => closeReinforcement(r.id!, "cancelled"),
          });
          router.push("/accueil");
        });
      }}
    >
      {dialog}
      <label htmlFor="match_id">Match concerné</label>
      <select id="match_id" name="match_id" defaultValue={defaultMatchId} required>
        {matches.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
      </select>

      <label htmlFor="position">Poste</label>
      <select id="position" name="position" defaultValue="">
        <option value="">Indifférent</option>
        {REINFORCEMENT_POSITIONS.map((key) => [key, POSITION_LABELS[key]] as const).map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>

      <label htmlFor="sex">Joueur ou joueuse</label>
      <select id="sex" name="sex" defaultValue="">
        <option value="">Indifférent</option>
        <option value="F">Une joueuse</option>
        <option value="M">Un joueur</option>
      </select>

      <label htmlFor="note">Message (facultatif)</label>
      <textarea id="note" name="note" rows={3} maxLength={300} placeholder="Ex. : covoiturage possible depuis le gymnase" />

      <p className="muted small">
        La demande s&apos;affiche sur l&apos;accueil de tous les adhérents, et une notification est
        envoyée à ceux qui correspondent (hors de votre équipe).
      </p>
      {error && <p className="error" role="alert">{error}</p>}
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Envoi…" : "Publier la demande"}
      </button>
    </form>
  );
}
