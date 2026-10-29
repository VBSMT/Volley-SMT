"use client";

import { useState, useTransition } from "react";
import { NOTIFICATION_PREFS, type NotificationPref } from "@/lib/member-types";
import { updateNotificationPref } from "./actions";

export function NotificationPrefs({ initial }: { initial: Record<NotificationPref, boolean> }) {
  const [prefs, setPrefs] = useState(initial);
  const [error, setError] = useState<string>();
  const [, startTransition] = useTransition();

  return (
    <fieldset className="stack">
      <legend>Me prévenir pour</legend>
      {NOTIFICATION_PREFS.map(({ key, label }) => (
        <label key={key} className="checkbox">
          <input
            type="checkbox"
            checked={prefs[key]}
            onChange={(e) => {
              const value = e.target.checked;
              setPrefs((p) => ({ ...p, [key]: value }));
              startTransition(async () => {
                const result = await updateNotificationPref(key, value);
                if (result.error) {
                  setPrefs((p) => ({ ...p, [key]: !value }));
                  setError(result.error);
                } else setError(undefined);
              });
            }}
          />
          {label}
        </label>
      ))}
      <p className="muted small">Un type décoché n&apos;est envoyé ni en notification ni par email.</p>
      {error && <p className="error small" role="alert">{error}</p>}
    </fieldset>
  );
}
