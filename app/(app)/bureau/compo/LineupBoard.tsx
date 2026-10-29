"use client";

import { useRef, useState, useTransition } from "react";
import { useToast } from "@/components/Feedback";
import { moveLineupPlayers } from "./actions";

export type BoardPlayer = { id: string; name: string; girl: boolean; positions: string; level: number | null };

/** Niveau par défaut d'un joueur sans niveau (comme l'algorithme). */
const DEFAULT_LEVEL = 3;

/**
 * Compo du soir modifiable : glisser-déposer un joueur (poignée ⠿) vers une autre équipe,
 * ou, au clavier / sans glisser : toucher la poignée puis « Mettre ici » sur l'équipe voulue.
 */
export function LineupBoard({ sessionId, teams: initial, players }: { sessionId: string; teams: string[][]; players: BoardPlayer[] }) {
  const byId = new Map(players.map((p) => [p.id, p]));
  const [teams, setTeams] = useState(initial);
  const [selected, setSelected] = useState<string>();
  const [drag, setDrag] = useState<{ id: string; x: number; y: number; over: number | null }>();
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const start = useRef<{ id: string; x: number; y: number; moved: boolean }>(null);

  const teamOf = (id: string) => teams.findIndex((t) => t.includes(id));

  const move = (id: string, to: number) => {
    const from = teamOf(id);
    setSelected(undefined);
    if (from < 0 || from === to) return;
    const previous = teams;
    const next = teams.map((t, k) => (k === from ? t.filter((x) => x !== id) : k === to ? [...t, id] : t));
    setTeams(next);
    startTransition(async () => {
      const r = await moveLineupPlayers(sessionId, next);
      if (r.error) {
        setTeams(previous);
        setError(r.error);
        return;
      }
      setError(undefined);
      toast({
        message: `${byId.get(id)?.name ?? "Joueur"} → équipe ${to + 1}.`,
        undo: async () => {
          const u = await moveLineupPlayers(sessionId, previous);
          if (!u.error) setTeams(previous);
          return u;
        },
      });
    });
  };

  const teamUnder = (x: number, y: number) => {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-team]");
    return el ? Number(el.dataset.team) : null;
  };

  const onPointerDown = (e: React.PointerEvent, id: string) => {
    if (e.button !== 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    start.current = { id, x: e.clientX, y: e.clientY, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const s = start.current;
    if (!s) return;
    if (!s.moved && Math.hypot(e.clientX - s.x, e.clientY - s.y) < 6) return;
    s.moved = true;
    // Défilement automatique près des bords de l'écran.
    if (e.clientY < 90) window.scrollBy(0, -12);
    else if (e.clientY > window.innerHeight - 130) window.scrollBy(0, 12);
    setDrag({ id: s.id, x: e.clientX, y: e.clientY, over: teamUnder(e.clientX, e.clientY) });
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const s = start.current;
    start.current = null;
    setDrag(undefined);
    if (!s) return;
    if (!s.moved) {
      // Simple toucher : sélection pour « Mettre ici ».
      setSelected((cur) => (cur === s.id ? undefined : s.id));
      return;
    }
    const to = teamUnder(e.clientX, e.clientY);
    if (to !== null) move(s.id, to);
  };

  const sum = (ids: string[]) => ids.reduce((acc, id) => acc + (byId.get(id)?.level ?? DEFAULT_LEVEL), 0);

  return (
    <div className="stack">
      <p className="muted small">
        Glissez un joueur par sa poignée ⠿ vers une autre équipe, ou touchez la poignée puis « Mettre ici ».
      </p>
      <ol className="lineup" onKeyDown={(e) => e.key === "Escape" && setSelected(undefined)}>
        {teams.map((ids, k) => {
          const girls = ids.filter((id) => byId.get(id)?.girl).length;
          const canDrop = selected && teamOf(selected) !== k;
          return (
            <li key={k} className={`card lineup-team${drag?.over === k && teamOf(drag.id) !== k ? " drop-target" : ""}`} data-team={k}>
              <div className="lineup-team-head">
                <h3>
                  Équipe {k + 1}{" "}
                  <span className="muted small">
                    · niveau {sum(ids)} · {girls} fille{girls > 1 ? "s" : ""} · {ids.length} joueur{ids.length > 1 ? "s" : ""}
                  </span>
                </h3>
                {canDrop && (
                  <button type="button" className="btn-primary drop-here" disabled={pending} onClick={() => move(selected, k)}>
                    Mettre ici
                  </button>
                )}
              </div>
              <ul className="lineup-players">
                {ids.map((id) => {
                  const p = byId.get(id);
                  return (
                    <li key={id} className={`${selected === id ? "is-selected" : ""}${drag?.id === id ? " is-dragging" : ""}`}>
                      <button
                        type="button"
                        className="drag-handle"
                        aria-label={`Déplacer ${p?.name ?? "ce joueur"}`}
                        aria-pressed={selected === id}
                        disabled={pending}
                        onPointerDown={(e) => onPointerDown(e, id)}
                        onPointerMove={onPointerMove}
                        onPointerUp={onPointerUp}
                        onPointerCancel={() => {
                          start.current = null;
                          setDrag(undefined);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelected((cur) => (cur === id ? undefined : id));
                          }
                        }}
                      >
                        ⠿
                      </button>
                      <span className="lineup-name">
                        {p?.name ?? "Adhérent"} {p?.girl && <span aria-label="fille">♀</span>}
                      </span>
                      <span className="muted small">
                        {p?.positions || "poste ?"} · {p?.level ?? "?"}
                      </span>
                    </li>
                  );
                })}
                {!ids.length && <li className="muted small">Aucun joueur</li>}
              </ul>
            </li>
          );
        })}
      </ol>
      {drag && (
        <div className="drag-ghost" style={{ left: drag.x, top: drag.y }} aria-hidden>
          {byId.get(drag.id)?.name}
        </div>
      )}
      {error && <p className="error small" role="alert">{error}</p>}
    </div>
  );
}
