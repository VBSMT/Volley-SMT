"use client";

import { useActionState } from "react";
import { LIMITS, type Schedule } from "@/lib/domain/settings";
import { submitWithoutReset } from "@/lib/use-form-submit";
import { saveSchedule, type SettingsState } from "./actions";

const range = (key: keyof typeof LIMITS) =>
  Array.from({ length: LIMITS[key].max - LIMITS[key].min + 1 }, (_, i) => LIMITS[key].min + i);

export function ScheduleForm({ schedule }: { schedule: Schedule }) {
  const [state, formAction, pending] = useActionState(saveSchedule, { status: "idle" } as SettingsState);
  return (
    <form onSubmit={submitWithoutReset(formAction)} className="card stack">
      <h2>Horaires</h2>
      <label htmlFor="reminderHour">Notification la veille de l&apos;entraînement (et 2 jours avant un match)</label>
      <select id="reminderHour" name="reminderHour" defaultValue={schedule.reminderHour}>
        {range("reminderHour").map((h) => <option key={h} value={h}>{h}h</option>)}
      </select>
      <label htmlFor="closeHour">Clôture du sondage et calcul de la compo, le jour J</label>
      <select id="closeHour" name="closeHour" defaultValue={schedule.closeHour}>
        {range("closeHour").map((h) => <option key={h} value={h}>{h}h</option>)}
      </select>
      <label htmlFor="expiryDays">Expiration d&apos;un report non confirmé</label>
      <select id="expiryDays" name="expiryDays" defaultValue={schedule.expiryDays}>
        {range("expiryDays").map((d) => <option key={d} value={d}>J-{d} de la date demandée</option>)}
      </select>
      {state.status === "saved" && <p className="success" role="status">Réglages enregistrés.</p>}
      {state.status === "error" && <p className="error" role="alert">{state.message}</p>}
      <button type="submit" className="btn-primary" disabled={pending}>{pending ? "Enregistrement…" : "Enregistrer"}</button>
    </form>
  );
}
