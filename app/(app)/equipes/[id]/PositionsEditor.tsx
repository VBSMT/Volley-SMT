"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/components/Feedback";
import { PLAYER_POSITIONS, POSITION_LABELS, type Position } from "@/lib/member-types";
import { setPlayerPositions } from "../actions";

type Player = { id: string; name: string; p1: string | null; p2: string | null };

/** Capitaine / Bureau : postes des joueurs de l'équipe, enregistrés à chaque changement (annulable). */
export function PositionsEditor({ players }: { players: Player[] }) {
  const toast = useToast();
  const [values, setValues] = useState(() => new Map(players.map((p) => [p.id, { p1: p.p1, p2: p.p2 }])));
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const change = (p: Player, key: "p1" | "p2", value: string) => {
    const before = values.get(p.id)!;
    const next = { ...before, [key]: value || null };
    if (next.p2 && next.p2 === next.p1) next.p2 = null;
    setValues(new Map(values).set(p.id, next));
    startTransition(async () => {
      const r = await setPlayerPositions(p.id, next.p1, next.p2);
      if (r.error) {
        setValues((v) => new Map(v).set(p.id, before));
        return setError(r.error);
      }
      setError(undefined);
      toast({
        message: `Postes de ${p.name} enregistrés.`,
        undo: async () => {
          const u = await setPlayerPositions(p.id, before.p1, before.p2);
          if (!u.error) setValues((v) => new Map(v).set(p.id, before));
          return u;
        },
      });
    });
  };

  const select = (p: Player, key: "p1" | "p2", label: string) => (
    <select
      aria-label={`${label} de ${p.name}`}
      value={values.get(p.id)![key] ?? ""}
      disabled={pending}
      onChange={(e) => change(p, key, e.target.value)}
    >
      <option value="">{key === "p1" ? "Poste 1 ?" : "Poste 2 —"}</option>
      {(values.get(p.id)![key] === "front" ? (["front", ...PLAYER_POSITIONS] as Position[]) : PLAYER_POSITIONS)
        .map((k) => [k, k === "front" ? "Avant (côté ?)" : POSITION_LABELS[k]] as const)
        .filter(([k]) => key === "p1" || k !== values.get(p.id)!.p1)
        .map(([k, l]) => (
          <option key={k} value={k}>
            {l}
          </option>
        ))}
    </select>
  );

  return (
    <div className="stack">
      <ul className="roster roster-edit">
        {players.map((p) => (
          <li key={p.id}>
            <span>{p.name}</span>
            <span className="roster-selects">
              {select(p, "p1", "Poste 1")}
              {select(p, "p2", "Poste 2")}
            </span>
          </li>
        ))}
      </ul>
      {error && <p className="error small" role="alert">{error}</p>}
    </div>
  );
}
