"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { useToast } from "@/components/Feedback";
import { PlayerCard } from "@/components/game/PlayerCard";
import { shardPrice } from "@/lib/domain/game-rewards";
import { shortName } from "@/lib/format";
import { exchangeShards } from "./actions";
import { type GameCard, cardKey } from "@/lib/domain/game";
import { CollectionAlbum } from "./CollectionAlbum";
import { CollectionCarousel } from "./CollectionCarousel";

type Entry = { card: GameCard; copies: number };

/**
 * Onglet Collection : progression et éclats en tête, album rangé par équipe / poste / rareté ;
 * toucher une carte l'ouvre en grand (carrousel de sa rubrique, retournable).
 */
export function CollectionView({ entries, all, shards }: { entries: Entry[]; all: GameCard[]; shards: number }) {
  const [open, setOpen] = useState<{ key: string; keys: string[] } | null>(null);
  const [exchanging, setExchanging] = useState(false);
  const [buying, setBuying] = useState<GameCard | null>(null);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const buyDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (buying) buyDialog.current?.showModal();
    else buyDialog.current?.close();
  }, [buying]);
  const buy = () =>
    startTransition(async () => {
      if (!buying) return;
      const r = await exchangeShards(cardKey(buying));
      if (r.error) return setError(r.error);
      toast({ message: `${shortName(buying.firstName, buying.lastName)} rejoint ta collection !` });
      setBuying(null);
      setError(undefined);
      router.refresh();
    });
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
          <button type="button" className={`shard-chip${exchanging ? " is-on" : ""}`} aria-pressed={exchanging} onClick={() => setExchanging((v) => !v)}>
            ✦ {shards} éclat{shards > 1 ? "s" : ""}
          </button>
        </div>
        <div className="collection-bar" role="progressbar" aria-label="Collection complétée" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <span style={{ width: `${pct}%` }} />
        </div>
      </div>
      {exchanging && (
        <p className="exchange-banner">
          <span>
            <strong>Mode échange</strong> : touche une carte manquante. ✦ 5 la commune, ✦ 20 la rare (1 éclat par doublon ouvert).
          </span>
          <button type="button" className="chip" onClick={() => setExchanging(false)}>
            Terminer
          </button>
        </p>
      )}
      <CollectionAlbum
        entries={entries}
        all={all}
        onOpen={(key, keys) => setOpen({ key, keys })}
        exchange={exchanging ? { shards, onBuy: setBuying } : undefined}
      />
      <dialog ref={buyDialog} className="confirm-dialog buy-dialog" onClose={() => setBuying(null)} aria-labelledby="buy-title">
        {buying && (
          <div className="stack">
            <h2 id="buy-title">Échanger {shardPrice(buying)} éclats ?</h2>
            <div className="buy-preview">
              <PlayerCard card={buying} />
            </div>
            <p className="small">
              Il te restera ✦ {shards - (shardPrice(buying) ?? 0)} éclat{shards - (shardPrice(buying) ?? 0) > 1 ? "s" : ""}.
            </p>
            {error && <p className="error" role="alert">{error}</p>}
            <div className="action-row">
              <button type="button" className="btn-secondary" onClick={() => setBuying(null)} disabled={pending}>
                Retour
              </button>
              <button type="button" className="btn-primary" onClick={buy} disabled={pending} autoFocus>
                {pending ? "…" : `Obtenir · ✦ ${shardPrice(buying)}`}
              </button>
            </div>
          </div>
        )}
      </dialog>
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
