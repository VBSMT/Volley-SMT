"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { answerMatchPoll, cancelMatchPoll, launchMatchPoll } from "@/app/(app)/matchs/actions";
import { useConfirm, useToast } from "@/components/Feedback";
import type { MatchPollView } from "@/lib/match-polls";

const plural = (n: number, w: string) => `${n} ${w}${n > 1 ? "s" : ""}`;

export function MatchPoll({
  poll,
  canAnswer,
  canManage,
  past,
}: {
  poll: MatchPollView;
  canAnswer: boolean;
  canManage: boolean;
  past: boolean;
}) {
  const [optimistic, setOptimistic] = useOptimistic(poll.myAnswer);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const { confirm, dialog } = useConfirm();

  const launch = async () => {
    const ok = await confirm("Lancer le sondage de présence ?", {
      text: "Les joueurs de l'équipe seront notifiés.",
      confirmLabel: "Lancer",
    });
    if (!ok) return;
    startTransition(async () => {
      const r = await launchMatchPoll(poll.matchId);
      setError(r.error);
      if (!r.error) toast({ message: "Sondage lancé : l'équipe est notifiée.", undo: () => cancelMatchPoll(poll.matchId) });
    });
  };
  const cancel = async () => {
    const ok = await confirm("Supprimer le sondage de présence ?", {
      text: "Toutes les réponses seront effacées.",
      confirmLabel: "Supprimer",
    });
    if (!ok) return;
    startTransition(async () => {
      const r = await cancelMatchPoll(poll.matchId);
      setError(r.error);
      if (!r.error) toast({ message: "Sondage supprimé." });
    });
  };

  if (!poll.launched) {
    if (!canManage || past) return <p className="muted small">Pas de sondage de présence pour ce match.</p>;
    return (
      <div className="stack">
        {dialog}
        <p className="muted small">Demandez à votre équipe qui est disponible : chacun est notifié.</p>
        <button
          type="button"
          className="btn-primary"
          disabled={pending}
          onClick={launch}
        >
          {pending ? "Envoi…" : "Lancer le sondage de présence"}
        </button>
        {error && <p className="error small" role="alert">{error}</p>}
      </div>
    );
  }

  // Retoucher le choix déjà sélectionné l'annule.
  const answer = (value: boolean) =>
    startTransition(async () => {
      const available = optimistic === value ? null : value;
      setOptimistic(available);
      const r = await answerMatchPoll(poll.matchId, available);
      setError(r.error);
    });

  return (
    <div className="stack">
      {canAnswer && !past && (
        <div className="poll" role="group" aria-label="Ma disponibilité">
          <button
            type="button"
            className={optimistic === true ? "poll-btn yes selected" : "poll-btn"}
            aria-pressed={optimistic === true}
            onClick={() => answer(true)}
          >
            Dispo
          </button>
          <button
            type="button"
            className={optimistic === false ? "poll-btn no selected" : "poll-btn"}
            aria-pressed={optimistic === false}
            onClick={() => answer(false)}
          >
            Pas dispo
          </button>
        </div>
      )}
      {error && <p className="error small" role="alert">{error}</p>}

      <details open={canManage}>
        <summary>
          {plural(poll.available.length, "dispo")} · {plural(poll.unavailable.length, "pas dispo")}
          {poll.pending && ` · ${poll.pending.length} sans réponse`}
        </summary>
        <div className="poll-lists">
          <div>
            <h4>Dispo</h4>
            {poll.available.length ? (
              <ul className="names">{poll.available.map((p) => <li key={p.id}>{p.name}</li>)}</ul>
            ) : (
              <p className="muted small">Personne pour l&apos;instant.</p>
            )}
          </div>
          {poll.unavailable.length > 0 && (
            <div>
              <h4>Pas dispo</h4>
              <ul className="names">{poll.unavailable.map((p) => <li key={p.id}>{p.name}</li>)}</ul>
            </div>
          )}
          {poll.pending && poll.pending.length > 0 && (
            <div>
              <h4>Sans réponse</h4>
              <ul className="names">{poll.pending.map((p) => <li key={p.id}>{p.name}</li>)}</ul>
            </div>
          )}
        </div>
      </details>

      {canManage && !past && poll.available.length < 4 && (
        <Link href={`/renforts/nouveau?match=${poll.matchId}`} className="btn-secondary center">
          Il manque du monde ? Demander un renfort
        </Link>
      )}
      {canManage && !past && (
        <button type="button" className="btn-secondary" disabled={pending} onClick={cancel}>
          Supprimer le sondage
        </button>
      )}
      {dialog}
    </div>
  );
}
