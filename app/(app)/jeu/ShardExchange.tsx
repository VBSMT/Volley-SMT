"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useConfirm, useToast } from "@/components/Feedback";
import { type GameCard, GAME_POSITION_LABELS, cardKey } from "@/lib/domain/game";
import { SHARDS_PER_CARD } from "@/lib/domain/game-rewards";
import { shortName } from "@/lib/format";
import { exchangeShards } from "./actions";

/** Éclats : solde, et échange de 5 éclats contre une carte commune ou rare au choix. */
export function ShardExchange({ shards, choices, owned }: { shards: number; choices: GameCard[]; owned: string[] }) {
  const router = useRouter();
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const [key, setKey] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const mine = new Set(owned);
  // Cartes manquantes d'abord, puis par note.
  const sorted = [...choices].sort((a, b) => Number(mine.has(cardKey(a))) - Number(mine.has(cardKey(b))) || b.rating - a.rating);
  const label = (c: GameCard) =>
    `${mine.has(cardKey(c)) ? "" : "✚ "}${shortName(c.firstName, c.lastName)} · ${GAME_POSITION_LABELS[c.position]}${c.kind === "rare" ? " ★" : ""} · ${c.teamName}`;

  return (
    <div className="card stack shard-box">
      {dialog}
      <p className="shard-count">
        <span aria-hidden="true">✦</span> {shards} éclat{shards > 1 ? "s" : ""}{" "}
        <span className="small muted">— 1 par doublon, {SHARDS_PER_CARD} pour une carte au choix</span>
      </p>
      {shards >= SHARDS_PER_CARD && (
        <div className="stack">
          <label className="small">
            Carte à obtenir (✚ = tu ne l&apos;as pas encore)
            <select value={key} onChange={(e) => setKey(e.target.value)}>
              <option value="">Choisir…</option>
              {sorted.map((c) => (
                <option key={cardKey(c)} value={cardKey(c)}>
                  {label(c)}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="btn-primary"
            disabled={!key || pending}
            onClick={async () => {
              const c = sorted.find((x) => cardKey(x) === key);
              if (!c || !(await confirm(`Échanger ${SHARDS_PER_CARD} éclats ?`, { text: label(c).replace("✚ ", ""), confirmLabel: "Échanger" }))) return;
              startTransition(async () => {
                const r = await exchangeShards(key);
                if (r.error) return setError(r.error);
                setError(undefined);
                setKey("");
                toast({ message: "Carte ajoutée à ta collection." });
                router.refresh();
              });
            }}
          >
            Échanger {SHARDS_PER_CARD} éclats
          </button>
        </div>
      )}
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  );
}
