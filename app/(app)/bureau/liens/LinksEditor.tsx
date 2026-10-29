"use client";

import { useState, useTransition } from "react";
import { useConfirm, useToast } from "@/components/Feedback";
import { deleteLink, saveLink } from "./actions";

type Link = { id: string; label: string; url: string };

function LinkRow({ link }: { link: Link }) {
  const [label, setLabel] = useState(link.label);
  const [url, setUrl] = useState(link.url);
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>();
  const [pending, startTransition] = useTransition();
  const { confirm, dialog } = useConfirm();
  const toast = useToast();
  const run = (fn: () => Promise<{ error?: string }>, ok: string) =>
    startTransition(async () => {
      const r = await fn();
      setMsg(r.error ? { ok: false, text: r.error } : { ok: true, text: ok });
    });
  return (
    <li className="card stack">
      {dialog}
      <input aria-label="Libellé" value={label} onChange={(e) => setLabel(e.target.value)} />
      <input aria-label="Adresse" type="url" value={url} onChange={(e) => setUrl(e.target.value)} />
      <div className="action-row">
        <button type="button" className="btn-secondary" disabled={pending} onClick={() => run(() => saveLink(link.id, label, url), "Enregistré")}>
          Enregistrer
        </button>
        <button type="button" className="btn-secondary" disabled={pending} onClick={async () => {
          if (!(await confirm(`Supprimer le lien « ${link.label} » ?`, { confirmLabel: "Supprimer" }))) return;
          startTransition(async () => {
            const r = await deleteLink(link.id);
            if (r.error) setMsg({ ok: false, text: r.error });
            else toast({ message: "Lien supprimé.", undo: () => saveLink(null, link.label, link.url) });
          });
        }}>
          Supprimer
        </button>
      </div>
      {msg && <p className={msg.ok ? "success small" : "error small"}>{msg.text}</p>}
    </li>
  );
}

export function LinksEditor({ links }: { links: Link[] }) {
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("https://");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  return (
    <div className="stack">
      <ul className="list">{links.map((l) => <LinkRow key={l.id} link={l} />)}</ul>
      <section className="card stack">
        <h2>Ajouter un lien</h2>
        <label htmlFor="new-label">Libellé</label>
        <input id="new-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex. : Règlement FSGT 4x4" />
        <label htmlFor="new-url">Adresse</label>
        <input id="new-url" type="url" value={url} onChange={(e) => setUrl(e.target.value)} />
        {error && <p className="error small" role="alert">{error}</p>}
        <button
          type="button"
          className="btn-primary"
          disabled={pending}
          onClick={() => startTransition(async () => {
            const r = await saveLink(null, label, url);
            setError(r.error);
            if (!r.error) { setLabel(""); setUrl("https://"); }
          })}
        >
          Ajouter
        </button>
      </section>
    </div>
  );
}
