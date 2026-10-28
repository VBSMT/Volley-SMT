"use client";

import { useOptimistic, useState, useTransition } from "react";
import { answerPoll } from "@/app/(app)/entrainements/actions";

export function PollButtons({ sessionId, answer }: { sessionId: string; answer: boolean | null }) {
  const [optimistic, setOptimistic] = useOptimistic(answer);
  const [error, setError] = useState<string>();
  const [, startTransition] = useTransition();

  const choose = (present: boolean) =>
    startTransition(async () => {
      setError(undefined);
      setOptimistic(present);
      const result = await answerPoll(sessionId, present);
      if (result.error) setError(result.error);
    });

  return (
    <div className="stack">
      <div className="poll" role="group" aria-label="Ma présence">
        <button
          type="button"
          className={optimistic === true ? "poll-btn yes selected" : "poll-btn"}
          aria-pressed={optimistic === true}
          onClick={() => choose(true)}
        >
          Je viens
        </button>
        <button
          type="button"
          className={optimistic === false ? "poll-btn no selected" : "poll-btn"}
          aria-pressed={optimistic === false}
          onClick={() => choose(false)}
        >
          Je ne viens pas
        </button>
      </div>
      {error && <p className="error small" role="alert">{error}</p>}
    </div>
  );
}
