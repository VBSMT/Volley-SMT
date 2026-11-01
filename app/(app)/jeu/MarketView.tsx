"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useConfirm, useToast } from "@/components/Feedback";
import { PlayerCard } from "@/components/game/PlayerCard";
import { type GameCard, cardKey } from "@/lib/domain/game";
import { MAX_ROUNDS, MIN_SALE, TRADES_PER_WEEK, offerErrors, tradable } from "@/lib/domain/market";
import { shortName } from "@/lib/format";
import { answerCounter, buyListing, cancelListing, cancelOffer, counterOffer, createListing, decideOffer, makeOffer } from "./market-actions";

export type ListingRow = { id: string; seller: string; mine: boolean; card: GameCard; askShards: number | null; askCard: GameCard | null; createdAt: string };
export type OfferRow = { id: string; listingId: string; buyer: string; shards: number; cards: GameCard[]; status: string; card: GameCard | null; mine: boolean; fromSeller: boolean; round: number };
type Owned = { card: GameCard; copies: number };

const name = (c: GameCard) => `${shortName(c.firstName, c.lastName)}${c.kind === "rare" ? " ★" : c.kind === "captain" ? " (C)" : ""}`;
const STATUS: Record<string, string> = { pending: "⏳ En attente", accepted: "✓ Acceptée", refused: "✕ Refusée", cancelled: "Annulée", countered: "↔ Contre-offre" };
const terms = (o: { shards: number; cards: GameCard[] }) => [o.shards ? `✦ ${o.shards}` : "", ...o.cards.map(name)].filter(Boolean).join(" + ");
type Sub = "annonces" | "ventes" | "offres" | "banque";

/** Marché VUT : annonces des autres, mes ventes (offres reçues), mes offres, et la banque. */
export function MarketView({ listings, offers, owned, all, shards, bank, sellKey }: { listings: ListingRow[]; offers: OfferRow[]; owned: Owned[]; all: GameCard[]; shards: number; bank: React.ReactNode; sellKey?: string }) {
  // Ouvert depuis l'album avec une carte choisie : directement sa mise en vente.
  const [sub, setSub] = useState<Sub>(sellKey ? "ventes" : "annonces");
  const [offerFor, setOfferFor] = useState<ListingRow | null>(null);
  const [counterFor, setCounterFor] = useState<OfferRow | null>(null);
  const [selling, setSelling] = useState(!!sellKey);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const { confirm, dialog } = useConfirm();
  const toast = useToast();
  const router = useRouter();

  const run = (action: () => Promise<{ error?: string }>, ok: string) =>
    start(async () => {
      const r = await action();
      if (r.error) return setError(r.error);
      setError(undefined);
      setOfferFor(null);
      setCounterFor(null);
      setSelling(false);
      toast({ message: ok });
      router.refresh();
    });

  const others = listings.filter((l) => !l.mine);
  const mineListings = listings.filter((l) => l.mine);
  const received = offers.filter((o) => !o.mine);
  const sent = offers.filter((o) => o.mine);
  const SUBS: [Sub, string, number][] = [
    ["annonces", "Annonces", others.length],
    ["ventes", "Ventes", received.filter((o) => o.status === "pending" && !o.fromSeller).length],
    ["offres", "Offres", sent.filter((o) => o.status === "pending" && o.fromSeller).length],
    ["banque", "Banque", 0],
  ];

  const ask = (l: ListingRow) => [l.askShards !== null ? `✦ ${l.askShards}` : "", l.askCard ? name(l.askCard) : ""].filter(Boolean).join(" ou ");

  return (
    <div className="stack">
      {dialog}
      <div className="chip-row market-subs" role="tablist">
        {SUBS.map(([k, label, n]) => (
          <button key={k} type="button" role="tab" aria-selected={sub === k} className={`chip${sub === k ? " is-on" : ""}`} onClick={() => setSub(k)}>
            {label}
            {n > 0 && <span className="chat-badge">{n}</span>}
          </button>
        ))}
      </div>
      <p className="small muted">✦ {shards} éclats · {TRADES_PER_WEEK} échanges par semaine au plus · Légendes jamais échangeables.</p>
      {error && <p className="error" role="alert">{error}</p>}

      {sub === "annonces" &&
        (others.length ? (
          <ul className="market-list">
            {others.map((l) => (
              <li key={l.id} className="market-item card">
                <span className="mini-card" aria-hidden="true"><PlayerCard card={l.card} /></span>
                <div className="stack market-info">
                  <strong>{name(l.card)}</strong>
                  <span className="small muted">{l.card.teamName} · par {l.seller}</span>
                  <span className="small">Veut : <b>{ask(l)}</b></span>
                  <div className="action-row">
                    {l.askShards !== null && (
                      <button type="button" className="btn-primary market-btn" disabled={pending || shards < l.askShards}
                        onClick={async () => (await confirm(`Acheter ${name(l.card)} pour ✦ ${l.askShards} ?`, { confirmLabel: "Acheter" })) && run(() => buyListing(l.id, "shards"), "Échange fait !")}>
                        ✦ {l.askShards}
                      </button>
                    )}
                    {l.askCard && (
                      <button type="button" className="btn-primary market-btn" disabled={pending || !owned.some((o) => cardKey(o.card) === cardKey(l.askCard!))}
                        onClick={async () => (await confirm(`Échanger ${name(l.askCard!)} contre ${name(l.card)} ?`, { confirmLabel: "Échanger" })) && run(() => buyListing(l.id, "card"), "Échange fait !")}>
                        ⇄ {name(l.askCard)}
                      </button>
                    )}
                    <button type="button" className="btn-secondary market-btn" disabled={pending} onClick={() => setOfferFor(l)}>
                      Faire une offre
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="small muted">Aucune annonce pour l&apos;instant.</p>
        ))}

      {sub === "ventes" && (
        <div className="stack">
          <button type="button" className="btn-primary" onClick={() => setSelling(true)}>+ Mettre une carte en vente</button>
          {mineListings.length === 0 && <p className="small muted">Aucune carte en vente.</p>}
          {mineListings.map((l) => (
            <div key={l.id} className="card stack">
              <div className="market-item">
                <span className="mini-card" aria-hidden="true"><PlayerCard card={l.card} /></span>
                <div className="stack market-info">
                  <strong>{name(l.card)}</strong>
                  <span className="small">Tu demandes : <b>{ask(l)}</b></span>
                  <button type="button" className="chip chip-small" disabled={pending}
                    onClick={async () => (await confirm("Retirer cette annonce ?", { text: "Les offres en attente seront refusées.", confirmLabel: "Retirer" })) && run(() => cancelListing(l.id), "Annonce retirée.")}>
                    Retirer l&apos;annonce
                  </button>
                </div>
              </div>
              {received.filter((o) => o.listingId === l.id && o.status === "pending" && o.fromSeller).map((o) => (
                <div key={o.id} className="market-offer">
                  <span>↔ Ta contre-offre à <b>{o.buyer}</b> : {terms(o)} · ⏳ en attente de sa réponse</span>
                </div>
              ))}
              {received.filter((o) => o.listingId === l.id && o.status === "pending" && !o.fromSeller).map((o) => (
                <div key={o.id} className="market-offer">
                  <span>🔁 <b>{o.buyer}</b> propose {terms(o)}</span>
                  <div className="action-row">
                    <button type="button" className="btn-primary market-btn" disabled={pending}
                      onClick={async () => (await confirm("Accepter cette offre ?", { text: "L'échange se fait tout de suite.", confirmLabel: "Accepter" })) && run(() => decideOffer(o.id, true), "Échange fait !")}>
                      Accepter
                    </button>
                    <button type="button" className="btn-secondary market-btn" disabled={pending}
                      onClick={async () => (await confirm("Refuser cette offre ?", { confirmLabel: "Refuser" })) && run(() => decideOffer(o.id, false), "Offre refusée.")}>
                      Refuser
                    </button>
                    {o.round < MAX_ROUNDS && (
                      <button type="button" className="btn-secondary market-btn" disabled={pending} onClick={() => setCounterFor(o)}>
                        Contre-offre
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {sub === "offres" &&
        (sent.length ? (
          <ul className="market-list">
            {sent.map((o) => (
              <li key={o.id} className="market-offer card">
                {o.fromSeller && o.status === "pending" ? (
                  <>
                    <span>
                      ↔ <b>Contre-offre du vendeur</b> pour {o.card ? name(o.card) : "la carte"} : il demande <b>{terms(o)}</b>
                    </span>
                    <div className="action-row">
                      <button type="button" className="btn-primary market-btn" disabled={pending}
                        onClick={async () => (await confirm("Accepter la contre-offre ?", { text: `Tu donnes ${terms(o)} ; l'échange se fait tout de suite.`, confirmLabel: "Accepter" })) && run(() => answerCounter(o.id, true), "Échange fait !")}>
                        Accepter
                      </button>
                      <button type="button" className="btn-secondary market-btn" disabled={pending}
                        onClick={async () => (await confirm("Refuser la contre-offre ?", { confirmLabel: "Refuser" })) && run(() => answerCounter(o.id, false), "Contre-offre refusée.")}>
                        Refuser
                      </button>
                      {o.round < MAX_ROUNDS && listings.find((l) => l.id === o.listingId) && (
                        <button type="button" className="btn-secondary market-btn" disabled={pending} onClick={() => setOfferFor(listings.find((l) => l.id === o.listingId)!)}>
                          Contre-proposer
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                <span>
                  {o.card ? name(o.card) : "Carte"} contre {terms(o)} · <b>{o.fromSeller && o.status !== "pending" ? `Contre-offre ${(STATUS[o.status] ?? o.status).toLowerCase()}` : (STATUS[o.status] ?? o.status)}</b>
                </span>
                )}
                {o.status === "pending" && !o.fromSeller && (
                  <button type="button" className="chip chip-small" disabled={pending} onClick={() => run(() => cancelOffer(o.id), "Offre annulée.")}>
                    Annuler
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="small muted">Aucune offre envoyée.</p>
        ))}

      {sub === "banque" && bank}

      {offerFor && <OfferDialog listing={offerFor} choices={owned.map((o) => o.card)} maxShards={shards} pending={pending} onClose={() => setOfferFor(null)} onSend={(s, keys) => run(() => makeOffer(offerFor.id, s, keys), "Offre envoyée.")} />}
      {counterFor?.card && (
        <OfferDialog
          title={`Contre-offre à ${counterFor.buyer}`}
          hint="Ce que tu demandes en échange : des éclats, et/ou une carte de même rareté, ou plusieurs cartes moins rares (qu'il doit posséder)."
          listing={{ id: counterFor.listingId, seller: "", mine: true, card: counterFor.card, askShards: null, askCard: null, createdAt: "" }}
          choices={all.filter((c) => c.memberId !== counterFor.card!.memberId || c.kind !== counterFor.card!.kind)}
          maxShards={999}
          pending={pending}
          onClose={() => setCounterFor(null)}
          onSend={(s, keys) => run(() => counterOffer(counterFor.id, s, keys), "Contre-offre envoyée.")}
        />
      )}
      {selling && <SellDialog initialKey={sellKey} owned={owned} all={all} pending={pending} onClose={() => setSelling(false)} onSend={(key, s, askKey) => run(() => createListing(key, s, askKey), "Carte mise en vente.")} />}
    </div>
  );
}

function OfferDialog({
  listing,
  choices: pool,
  maxShards,
  title,
  hint,
  pending,
  onClose,
  onSend,
}: {
  listing: ListingRow;
  /** Cartes proposables : les siennes (offre) ou celles du club (contre-offre du vendeur). */
  choices: GameCard[];
  maxShards: number;
  title?: string;
  hint?: string;
  pending: boolean;
  onClose: () => void;
  onSend: (shards: number, keys: string[]) => void;
}) {
  const kind = listing.card.kind ?? "common";
  const shards = maxShards;
  const [give, setGive] = useState(0);
  const [picked, setPicked] = useState<string[]>([]);
  const RANK = { common: 1, rare: 2, captain: 3, legend: 4 } as const;
  const choices = pool.filter((c) => tradable(c.kind ?? "common") && RANK[c.kind ?? "common"] <= RANK[kind]).map((card) => ({ card }));
  const cards = choices.filter((o) => picked.includes(cardKey(o.card))).map((o) => ({ memberId: o.card.memberId, teamId: o.card.teamId, kind: o.card.kind ?? "common" }));
  const errors = offerErrors(kind, give, cards);
  return (
    <dialog open className="fixtures-sheet market-sheet" aria-labelledby="offer-title">
      <div className="fixtures-head">
        <h2 id="offer-title">{title ?? `Ton offre pour ${name(listing.card)}`}</h2>
        <button type="button" className="fixtures-close" onClick={onClose} aria-label="Fermer">✕</button>
      </div>
      <p className="small muted">{hint ?? `Des éclats (✦ ${MIN_SALE[kind as keyof typeof MIN_SALE]} minimum s'ils sont seuls), et/ou une carte de même rareté, ou plusieurs cartes moins rares.`}</p>
      <div className="market-pick">
        {choices.map((o) => {
          const k = cardKey(o.card);
          const on = picked.includes(k);
          return (
            <button key={k} type="button" className={`market-pick-card${on ? " is-on" : ""}`} aria-pressed={on} onClick={() => setPicked((p) => (on ? p.filter((x) => x !== k) : [...p, k]))} aria-label={name(o.card)}>
              <span className="mini-card" aria-hidden="true"><PlayerCard card={o.card} /></span>
            </button>
          );
        })}
      </div>
      <div className="market-stepper">
        <span>+ éclats</span>
        <button type="button" className="chip chip-small" onClick={() => setGive((g) => Math.max(0, g - 1))} aria-label="Moins d'éclats">−</button>
        <b>✦ {give}</b>
        <button type="button" className="chip chip-small" onClick={() => setGive((g) => Math.min(shards, g + 1))} aria-label="Plus d'éclats">+</button>
        <button type="button" className="chip chip-small" onClick={() => setGive((g) => Math.min(shards, g + 5))} aria-label="5 éclats de plus">+5</button>
      </div>
      {errors.length > 0 && (give > 0 || picked.length > 0) && <p className="small error">{errors[0]}</p>}
      <button type="button" className="btn-primary" disabled={pending || errors.length > 0} onClick={() => onSend(give, picked)}>
        {title ? "Envoyer la contre-offre" : "Envoyer l'offre"}
      </button>
    </dialog>
  );
}

function SellDialog({ initialKey, owned, all, pending, onClose, onSend }: { initialKey?: string; owned: Owned[]; all: GameCard[]; pending: boolean; onClose: () => void; onSend: (key: string, shards: number | null, askKey: string | null) => void }) {
  const choices = owned.filter((o) => tradable(o.card.kind ?? "common"));
  const [key, setKey] = useState(choices.find((o) => cardKey(o.card) === initialKey) ? initialKey! : choices[0] ? cardKey(choices[0].card) : "");
  const card = choices.find((o) => cardKey(o.card) === key)?.card;
  const kind = (card?.kind ?? "common") as keyof typeof MIN_SALE;
  const [useShards, setUseShards] = useState(true);
  const [price, setPrice] = useState(MIN_SALE[(choices.find((o) => cardKey(o.card) === key)?.card.kind ?? "common") as keyof typeof MIN_SALE]);
  const [askKey, setAskKey] = useState("");
  const sameRarity = all.filter((c) => (c.kind ?? "common") === kind && c.memberId !== card?.memberId);
  const ok = !!card && (useShards ? price >= MIN_SALE[kind] : true) && (useShards || !!askKey);
  return (
    <dialog open className="fixtures-sheet market-sheet" aria-labelledby="sell-title">
      <div className="fixtures-head">
        <h2 id="sell-title">Mettre une carte en vente</h2>
        <button type="button" className="fixtures-close" onClick={onClose} aria-label="Fermer">✕</button>
      </div>
      <label>
        Carte
        <select value={key} onChange={(e) => { setKey(e.target.value); setAskKey(""); const k = (choices.find((o) => cardKey(o.card) === e.target.value)?.card.kind ?? "common") as keyof typeof MIN_SALE; setPrice(MIN_SALE[k]); }}>
          {choices.map((o) => (
            <option key={cardKey(o.card)} value={cardKey(o.card)}>
              {name(o.card)} · {o.card.teamName}{o.copies > 1 ? ` (×${o.copies})` : ""}
            </option>
          ))}
        </select>
      </label>
      <label className="checkbox">
        <input type="checkbox" checked={useShards} onChange={(e) => setUseShards(e.target.checked)} />
        Prix en éclats (minimum ✦ {MIN_SALE[kind]})
      </label>
      {useShards && (
        <label>
          Prix
          <input type="number" min={MIN_SALE[kind]} value={price} onChange={(e) => setPrice(Number(e.target.value))} />
        </label>
      )}
      <label>
        {useShards ? "Ou une carte voulue (facultatif)" : "Carte voulue (même rareté)"}
        <select value={askKey} onChange={(e) => setAskKey(e.target.value)}>
          <option value="">—</option>
          {sameRarity.map((c) => (
            <option key={cardKey(c)} value={cardKey(c)}>
              {name(c)} · {c.teamName}
            </option>
          ))}
        </select>
      </label>
      <button type="button" className="btn-primary" disabled={pending || !ok} onClick={() => onSend(key, useShards ? price : null, askKey || null)}>
        Publier l&apos;annonce
      </button>
    </dialog>
  );
}
