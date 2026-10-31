"use client";

import { useState, useTransition } from "react";
import { answerEvent, answerVolunteer, clearEventAnswer, clearVolunteerAnswer } from "@/app/(app)/evenements/actions";
import type { EventDetail } from "@/lib/events";

export function AttendancePoll({ event, past }: { event: EventDetail; past: boolean }) {
  const mine = event.myAttendance;
  const [coming, setComing] = useState<boolean | null>(mine?.coming ?? null);
  const [partner, setPartner] = useState(!!mine?.with_partner);
  const [children, setChildren] = useState(mine?.children ?? 0);
  const [guests, setGuests] = useState(mine?.guests ?? 0);
  const [status, setStatus] = useState<{ ok: boolean; text: string }>();
  const [pending, startTransition] = useTransition();

  const save = (value: boolean) =>
    startTransition(async () => {
      setComing(value);
      const r = await answerEvent(event.id, { coming: value, with_partner: partner, children, guests });
      setStatus(r.error ? { ok: false, text: r.error } : { ok: true, text: "Réponse enregistrée." });
    });
  // Retoucher le choix déjà sélectionné l'annule.
  const toggle = (value: boolean) =>
    coming === value
      ? startTransition(async () => {
          setComing(null);
          const r = await clearEventAnswer(event.id);
          setStatus(r.error ? { ok: false, text: r.error } : { ok: true, text: "Réponse annulée." });
        })
      : save(value);

  if (past) return null;
  const extras = event.askPartner || event.askChildren || event.askGuests;
  return (
    <div className="stack">
      <div className="poll" role="group" aria-label="Ma présence">
        <button type="button" className={coming === true ? "poll-btn yes selected" : "poll-btn"} aria-pressed={coming === true} disabled={pending} onClick={() => toggle(true)}>
          Je viens
        </button>
        <button type="button" className={coming === false ? "poll-btn no selected" : "poll-btn"} aria-pressed={coming === false} disabled={pending} onClick={() => toggle(false)}>
          Je ne viens pas
        </button>
      </div>
      {coming === true && extras && (
        <div className="stack extras">
          {event.askPartner && (
            <label className="checkbox">
              <input type="checkbox" checked={partner} onChange={(e) => setPartner(e.target.checked)} />
              Je viens avec mon/ma conjoint·e
            </label>
          )}
          {event.askChildren && (
            <label className="inline-number">
              Enfants
              <input type="number" min={0} max={20} inputMode="numeric" value={children} onChange={(e) => setChildren(Number(e.target.value))} />
            </label>
          )}
          {event.askGuests && (
            <label className="inline-number">
              Autres invités
              <input type="number" min={0} max={20} inputMode="numeric" value={guests} onChange={(e) => setGuests(Number(e.target.value))} />
            </label>
          )}
          <button type="button" className="btn-secondary" disabled={pending} onClick={() => save(true)}>
            Mettre à jour
          </button>
        </div>
      )}
      {status && <p className={status.ok ? "success small" : "error small"} role="status">{status.text}</p>}
    </div>
  );
}

export function VolunteerPoll({ event, past }: { event: EventDetail; past: boolean }) {
  const v = event.volunteers!;
  const [available, setAvailable] = useState<boolean | null>(v.mine?.available ?? null);
  const [needId, setNeedId] = useState(v.mine?.need_id ?? v.needs[0]?.id ?? "");
  const [status, setStatus] = useState<{ ok: boolean; text: string }>();
  const [pending, startTransition] = useTransition();
  const save = (value: boolean) =>
    startTransition(async () => {
      setAvailable(value);
      const r = await answerVolunteer(event.id, value, value ? needId || null : null);
      setStatus(r.error ? { ok: false, text: r.error } : { ok: true, text: "Merci, c'est noté !" });
    });
  const toggle = (value: boolean) =>
    available === value
      ? startTransition(async () => {
          setAvailable(null);
          const r = await clearVolunteerAnswer(event.id);
          setStatus(r.error ? { ok: false, text: r.error } : { ok: true, text: "Réponse annulée." });
        })
      : save(value);

  if (past) return null;
  return (
    <div className="stack">
      {v.needs.length > 0 && (
        <>
          <label htmlFor="need">Poste souhaité</label>
          <select id="need" value={needId} onChange={(e) => setNeedId(e.target.value)}>
            {v.needs.map((n) => (
              <option key={n.id} value={n.id}>
                {n.label} ({n.filled}/{n.needed})
              </option>
            ))}
          </select>
        </>
      )}
      <div className="poll" role="group" aria-label="Ma disponibilité bénévole">
        <button type="button" className={available === true ? "poll-btn yes selected" : "poll-btn"} aria-pressed={available === true} disabled={pending} onClick={() => toggle(true)}>
          Disponible
        </button>
        <button type="button" className={available === false ? "poll-btn no selected" : "poll-btn"} aria-pressed={available === false} disabled={pending} onClick={() => toggle(false)}>
          Pas disponible
        </button>
      </div>
      {status && <p className={status.ok ? "success small" : "error small"} role="status">{status.text}</p>}
    </div>
  );
}
