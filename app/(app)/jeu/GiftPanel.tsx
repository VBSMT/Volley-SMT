"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { useConfirm, useToast } from "@/components/Feedback";
import { type Gift, type GiftTarget, cancelGifts, sendGift } from "./gift-actions";

type Option = { id: string; label: string };
export type GiftHistoryRow = { id: string; to: string; what: string; at: string; opened: boolean; message: string | null };

/** Cadeaux VUT (maître du jeu seulement) : boosters ou carte précise, avec message facultatif. */
export function GiftPanel({ players, teams, cards, history }: { players: Option[]; teams: Option[]; cards: Option[]; history: GiftHistoryRow[] }) {
  const router = useRouter();
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
  const [pending, start] = useTransition();
  const [to, setTo] = useState("all");
  const [kind, setKind] = useState<"boosters" | "card">("boosters");
  const [count, setCount] = useState(1);
  const [filter, setFilter] = useState("");
  const [cardKey, setCardKey] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string>();

  const shown = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return f ? cards.filter((c) => c.label.toLowerCase().includes(f)) : cards;
  }, [cards, filter]);

  const targetLabel = (to === "all" ? "Tous les adhérents" : (players.find((p) => `m:${p.id}` === to) ?? teams.find((t) => `t:${t.id}` === to))?.label) ?? "";
  const giftLabel = kind === "boosters" ? `${count} booster${count > 1 ? "s" : ""}` : (cards.find((c) => c.id === cardKey)?.label ?? "");

  const submit = async () => {
    if (kind === "card" && !cardKey) return setError("Choisis une carte.");
    if (!(await confirm("Envoyer ce cadeau ?", { text: `${giftLabel} → ${targetLabel}. Les joueurs sont notifiés.`, confirmLabel: "Envoyer" }))) return;
    const target: GiftTarget = to === "all" ? { type: "all" } : { type: to.startsWith("m:") ? "member" : "team", id: to.slice(2) };
    const gift: Gift = kind === "boosters" ? { type: "boosters", count } : { type: "card", key: cardKey };
    start(async () => {
      const r = await sendGift(target, gift, message);
      if (r.error) return setError(r.error);
      setError(undefined);
      setMessage("");
      toast({ message: r.message ?? "Envoyé.", undo: async () => { const u = await cancelGifts(r.ids ?? []); router.refresh(); return u; } });
      router.refresh();
    });
  };

  return (
    <details className="card stack">
      {dialog}
      <summary>🎁 Cadeaux (maître du jeu)</summary>
      <p className="small muted">Les adhérents hors Bureau trouveront leur cadeau à l&apos;ouverture du jeu à tous (pas de notification d&apos;ici là).</p>
      <label>
        À qui
        <select value={to} onChange={(e) => setTo(e.target.value)}>
          <option value="all">Tous les adhérents</option>
          <optgroup label="Un adhérent">
            {players.map((p) => <option key={p.id} value={`m:${p.id}`}>{p.label}</option>)}
          </optgroup>
          <optgroup label="Une équipe">
            {teams.map((t) => <option key={t.id} value={`t:${t.id}`}>{t.label}</option>)}
          </optgroup>
        </select>
      </label>
      <fieldset className="action-row gift-kind">
        <legend>Cadeau</legend>
        <label><input type="radio" name="gift-kind" checked={kind === "boosters"} onChange={() => setKind("boosters")} /> Booster(s)</label>
        <label><input type="radio" name="gift-kind" checked={kind === "card"} onChange={() => setKind("card")} /> Carte précise</label>
      </fieldset>
      {kind === "boosters" ? (
        <label>
          Nombre (2 ou 3 cartes au hasard chacun)
          <select value={count} onChange={(e) => setCount(Number(e.target.value))}>
            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      ) : (
        <>
          <label>
            Chercher une carte
            <input type="search" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Nom, équipe, rareté…" />
          </label>
          <label>
            Carte ({shown.length})
            <select value={cardKey} onChange={(e) => setCardKey(e.target.value)}>
              <option value="">— Choisir —</option>
              {shown.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </label>
        </>
      )}
      <label>
        Message (facultatif)
        <input type="text" maxLength={140} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Bravo pour le tournoi !" />
      </label>
      {error && <p role="alert" className="error">{error}</p>}
      <button type="button" className="btn-primary" disabled={pending} onClick={submit}>Envoyer le cadeau</button>
      {history.length > 0 && (
        <table className="ranking gift-history">
          <caption className="small">Derniers cadeaux</caption>
          <tbody>
            {history.map((h) => (
              <tr key={h.id}>
                <td>{h.at}</td>
                <td>{h.to}</td>
                <td>{h.what}{h.message ? ` · « ${h.message} »` : ""}</td>
                <td>
                  {h.opened ? "✓ ouvert" : (
                    <button type="button" className="btn-secondary gift-cancel" disabled={pending}
                      onClick={async () => {
                        if (!(await confirm("Annuler ce cadeau ?", { text: "Il disparaît de ses boosters à ouvrir.", confirmLabel: "Annuler le cadeau" }))) return;
                        start(async () => { const r = await cancelGifts([h.id]); toast({ message: r.error ?? r.message ?? "" }); router.refresh(); });
                      }}>
                      Annuler
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </details>
  );
}
