"use client";

import { useState, useTransition } from "react";
import { useConfirm, useToast } from "@/components/Feedback";
import { clearSimulations, giveBoosters, giveSpecials, recomputeNow, resetAll, simulateResult } from "./test-actions";

const SCORES = [
  ["s30", "Victoire 3-0"],
  ["s31", "Victoire 3-1"],
  ["s32", "Victoire 3-2"],
  ["s23", "Défaite 2-3"],
  ["s13", "Défaite 1-3"],
  ["s03", "Défaite 0-3"],
] as const;

/** Outils de test VUT (Bureau) : chaque action s'applique à tous les joueurs du jeu. */
export function TestTools({ teams }: { teams: { id: string; name: string }[] }) {
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const [teamId, setTeamId] = useState(teams[0]?.id ?? "");
  const [score, setScore] = useState<string>("s30");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const run = async (title: string, text: string, action: () => Promise<{ error?: string; message?: string }>) => {
    if (!(await confirm(title, { text, confirmLabel: "Confirmer" }))) return;
    startTransition(async () => {
      const r = await action();
      if (r.error) return setError(r.error);
      setError(undefined);
      toast({ message: r.message ?? "Fait." });
    });
  };

  return (
    <details className="card stack">
      {dialog}
      <summary>🛠 Outils de test (Bureau)</summary>
      <p className="small muted">Chaque action s&apos;applique à tous les joueurs qui ont accès au jeu.</p>
      <div className="action-row">
        <button type="button" className="btn-secondary" disabled={pending} onClick={() => run("Donner un booster à chacun ?", "2 ou 3 cartes au hasard, à ouvrir dans Mon équipe.", () => giveBoosters(1))}>
          + 1 booster à chacun
        </button>
        <button type="button" className="btn-secondary" disabled={pending} onClick={() => run("Recalculer les points ?", "Points provisoires de la semaine en cours.", recomputeNow)}>
          Recalculer les points
        </button>
        <button type="button" className="btn-secondary" disabled={pending} onClick={() => run("Donner un Capitaine et une Légende à chacun ?", "Pour tester la case Bonus.", giveSpecials)}>
          + Capitaine et Légende
        </button>
      </div>
      <fieldset className="stack">
        <legend>Simuler un résultat (semaine en cours)</legend>
        <label>
          Équipe
          <select value={teamId} onChange={(e) => setTeamId(e.target.value)}>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Score
          <select value={score} onChange={(e) => setScore(e.target.value)}>
            {SCORES.map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="btn-secondary"
          disabled={pending || !teamId}
          onClick={() => run("Simuler ce résultat ?", "La note de l'équipe et les points de la semaine sont recalculés.", () => simulateResult(teamId, score))}
        >
          Simuler
        </button>
      </fieldset>
      <div className="action-row">
        <button type="button" className="btn-secondary" disabled={pending} onClick={() => run("Effacer les simulations ?", "Résultats simulés supprimés, notes remises à 60 jusqu'à la prochaine synchro.", clearSimulations)}>
          Effacer les simulations
        </button>
        <button type="button" className="btn-danger" disabled={pending} onClick={() => run("Tout remettre à zéro ?", "Boosters, collections, équipes et points de tous les joueurs seront effacés.", resetAll)}>
          Remise à zéro complète
        </button>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
    </details>
  );
}
