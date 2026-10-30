"use client";

import { useEffect, useRef, useState } from "react";
import { type GameCard, cardKey } from "@/lib/domain/game";
import { CollectionAlbum } from "./CollectionAlbum";
import { CollectionCarousel } from "./CollectionCarousel";
import { ShardExchange } from "./ShardExchange";

type Entry = { card: GameCard; copies: number };

/**
 * Onglet Collection : progression et éclats en tête, album rangé par équipe / poste / rareté ;
 * toucher une carte l'ouvre en grand (carrousel de sa rubrique, retournable).
 */
export function CollectionView({ entries, all, shards, choices }: { entries: Entry[]; all: GameCard[]; shards: number; choices: GameCard[] }) {
  const [open, setOpen] = useState<{ key: string; keys: string[] } | null>(null);
  const [showShards, setShowShards] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);
  const pct = all.length ? Math.round((entries.length / all.length) * 100) : 0;
  const byKey = new Map(entries.map((e) => [cardKey(e.card), e]));

  return (
    <div className="stack">
      <div className="collection-top">
        <div className="collection-top-row">
          <strong className="collection-count">
            {entries.length} <span className="small muted">/ {all.length}</span>
          </strong>
          <button type="button" className="shard-chip" aria-expanded={showShards} onClick={() => setShowShards((v) => !v)}>
            ✦ {shards} éclat{shards > 1 ? "s" : ""}
          </button>
        </div>
        <div className="collection-bar" role="progressbar" aria-label="Collection complétée" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <span style={{ width: `${pct}%` }} />
        </div>
      </div>
      {showShards && <ShardExchange shards={shards} choices={choices} owned={entries.map((e) => cardKey(e.card))} />}
      <CollectionAlbum entries={entries} all={all} onOpen={(key, keys) => setOpen({ key, keys })} />
      <dialog ref={dialog} className="card-viewer" onClose={() => setOpen(null)} aria-label="Carte en grand">
        {open && (
          <>
            <button type="button" className="card-viewer-close" onClick={() => setOpen(null)} aria-label="Fermer">
              ✕
            </button>
            <CollectionCarousel
              bare
              total={all.length}
              initialKey={open.key}
              entries={open.keys.map((k) => byKey.get(k)).filter((e): e is Entry => !!e)}
            />
          </>
        )}
      </dialog>
    </div>
  );
}
