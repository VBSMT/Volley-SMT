"use client";

import { useState, useTransition } from "react";
import { setDues, setLicense } from "./actions";

export type SeasonRow = { id: string; name: string; teams: string; duesPaid: boolean; license: string; hasAccount: boolean };

function Row({ row }: { row: SeasonRow }) {
  const [paid, setPaid] = useState(row.duesPaid);
  const [license, setLicenseValue] = useState(row.license);
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>();
  const [pending, startTransition] = useTransition();
  return (
    <li className="card season-row">
      <div className="season-who">
        <p className="member-name">{row.name}</p>
        <p className="muted small">{row.teams || "Sans équipe"}{!row.hasAccount && " · sans compte"}</p>
      </div>
      <label className="checkbox small">
        <input
          type="checkbox"
          checked={paid}
          disabled={pending}
          onChange={(e) => {
            const v = e.target.checked;
            setPaid(v);
            startTransition(async () => {
              const r = await setDues(row.id, v);
              if (r.error) { setPaid(!v); setMsg({ ok: false, text: r.error }); }
            });
          }}
        />
        Cotisation réglée
      </label>
      <div className="need-row">
        <input aria-label={`Licence de ${row.name}`} placeholder="N° de licence" value={license} onChange={(e) => setLicenseValue(e.target.value)} />
        <button
          type="button"
          className="btn-secondary"
          disabled={pending || license === row.license}
          onClick={() => startTransition(async () => {
            const r = await setLicense(row.id, license);
            setMsg(r.error ? { ok: false, text: r.error } : { ok: true, text: "Licence enregistrée" });
          })}
        >
          OK
        </button>
      </div>
      {msg && <p className={msg.ok ? "success small" : "error small"}>{msg.text}</p>}
    </li>
  );
}

export function SeasonRows({ rows }: { rows: SeasonRow[] }) {
  return <ul className="list">{rows.map((r) => <Row key={r.id} row={r} />)}</ul>;
}
