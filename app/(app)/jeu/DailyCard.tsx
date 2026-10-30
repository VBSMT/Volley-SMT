"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useToast } from "@/components/Feedback";
import { type DailyState, STREAK_DAYS } from "@/lib/domain/game-rewards";
import { claimDaily } from "./actions";

/** Booster du jour : un par jour, un booster bonus au 7ᵉ jour de suite (un jour manqué remet à zéro). */
export function DailyCard({ state }: { state: DailyState }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, start] = useTransition();
  const { claimedToday, dayInCycle, streak, bonusToday } = state;
  // Jours déjà faits dans le cycle en cours (aujourd'hui compris s'il est récupéré).
  const done = claimedToday ? dayInCycle : dayInCycle - 1;

  const claim = () =>
    start(async () => {
      const r = await claimDaily();
      if (r.error) toast({ message: r.error });
      else {
        toast({ message: r.bonus ? "🎁 2 boosters récupérés, série de 7 jours !" : "🎁 Booster du jour récupéré" });
        router.refresh();
      }
    });

  return (
    <section className={`card daily-card${bonusToday && !claimedToday ? " is-bonus" : ""}`} aria-labelledby="daily-title">
      <div className="daily-head">
        <div className="daily-pack" aria-hidden="true">VUT</div>
        <div className="daily-text">
          <h2 id="daily-title" className="daily-title">{claimedToday ? "✓ Booster récupéré" : bonusToday ? "🔥 Série de 7 jours !" : "🎁 Booster du jour"}</h2>
          <p className="small muted">
            🔥 {streak} jour{streak > 1 ? "s" : ""} de suite
          </p>
        </div>
        <button type="button" className="btn-primary daily-button" disabled={claimedToday || busy} onClick={claim}>
          {claimedToday ? "À demain" : busy ? "…" : bonusToday ? "Récupérer ×2" : "Récupérer"}
        </button>
      </div>
      <ol className="daily-dots" aria-label={`Série : jour ${dayInCycle} sur ${STREAK_DAYS}, booster bonus au ${STREAK_DAYS}e jour, un jour manqué remet à zéro`}>
        {Array.from({ length: STREAK_DAYS }, (_, i) => (
          <li key={i} className={i < done ? "is-done" : i === done && !claimedToday ? "is-today" : ""}>
            {i === STREAK_DAYS - 1 ? "🎁" : i < done ? "✓" : i + 1}
          </li>
        ))}
      </ol>
    </section>
  );
}
