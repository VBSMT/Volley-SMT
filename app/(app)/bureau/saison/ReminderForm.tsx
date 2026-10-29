"use client";

import { useState, useTransition } from "react";
import { useConfirm } from "@/components/Feedback";
import { sendReminder } from "./actions";

const DEFAULT_TEXT = {
  dues: "Bonjour, ta cotisation pour la saison n'est pas encore réglée. Merci de voir avec le Bureau dès que possible. Sportivement !",
  license: "Bonjour, il nous manque ton numéro de licence FSGT pour la saison. Merci de le transmettre au Bureau. Sportivement !",
};

export function ReminderForm({ kind, count }: { kind: "dues" | "license"; count: number }) {
  const [text, setText] = useState(DEFAULT_TEXT[kind]);
  const [status, setStatus] = useState<{ ok: boolean; text: string }>();
  const [pending, startTransition] = useTransition();
  const { confirm, dialog } = useConfirm();
  if (!count) return <p className="success small">Personne à relancer.</p>;
  return (
    <details>
      <summary>Relancer {count} adhérent{count > 1 ? "s" : ""}</summary>
      <div className="stack">
        {dialog}
        <label htmlFor={`reminder-${kind}`}>Message</label>
        <textarea id={`reminder-${kind}`} rows={3} value={text} onChange={(e) => setText(e.target.value)} />
        <button
          type="button"
          className="btn-primary"
          disabled={pending}
          onClick={async () => (await confirm(`Envoyer la relance à ${count} adhérent${count > 1 ? "s" : ""} ?`, { text: "Notification aux adhérents qui les ont activées. Un envoi ne peut pas être annulé.", confirmLabel: "Envoyer" })) &&
            startTransition(async () => {
              const r = await sendReminder(kind, text);
              setStatus(r.error ? { ok: false, text: r.error } : { ok: true, text: `Relance envoyée à ${r.count} adhérent${(r.count ?? 0) > 1 ? "s" : ""} (notification).` });
            })}
        >
          {pending ? "Envoi…" : "Envoyer la relance"}
        </button>
        {status && <p className={status.ok ? "success small" : "error small"} role="status">{status.text}</p>}
      </div>
    </details>
  );
}
