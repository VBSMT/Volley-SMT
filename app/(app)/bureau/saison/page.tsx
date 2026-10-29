import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentMember, hasRole } from "@/lib/member";
import { getCurrentSeason } from "@/lib/season";
import { createClient } from "@/lib/supabase/server";
import { ReminderForm } from "./ReminderForm";
import { SeasonRows, type SeasonRow } from "./SeasonRows";

export const metadata: Metadata = { title: "Saison" };

const FILTERS = [
  { key: "", label: "Tous" },
  { key: "cotisation", label: "Cotisation non réglée" },
  { key: "licence", label: "Licence manquante" },
];

export default async function SaisonPage({ searchParams }: { searchParams: Promise<{ filtre?: string }> }) {
  if (!hasRole(await getCurrentMember(), "board")) notFound();
  const filter = (await searchParams).filtre ?? "";
  const supabase = await createClient();
  const [season, { data }] = await Promise.all([
    getCurrentSeason(supabase),
    supabase
      .from("members")
      .select("id, first_name, last_name, dues_paid, fsgt_license, user_id, member_teams(team:teams(name))")
      .order("last_name"),
  ]);
  const all: SeasonRow[] = (data ?? []).map((m) => ({
    id: m.id,
    name: `${m.last_name} ${m.first_name}`,
    teams: (m.member_teams as unknown as { team: { name: string } }[]).map((t) => t.team.name).join(", "),
    duesPaid: m.dues_paid,
    license: m.fsgt_license ?? "",
    hasAccount: !!m.user_id,
  }));
  const unpaid = all.filter((r) => !r.duesPaid);
  const noLicense = all.filter((r) => !r.license);
  const rows = filter === "cotisation" ? unpaid : filter === "licence" ? noLicense : all;
  const pct = (n: number) => (all.length ? Math.round((n / all.length) * 100) : 0);

  return (
    <main className="page stack">
      <Link href="/bureau" className="back">← Bureau</Link>
      <h1>Saison {season?.label ?? ""}</h1>

      <dl className="season-kpis">
        <div><dt>Adhérents</dt><dd>{all.length}</dd></div>
        <div><dt>Cotisations</dt><dd>{all.length - unpaid.length}<small>/{all.length}</small></dd>
          <span className="progress" aria-hidden="true"><span style={{ width: `${pct(all.length - unpaid.length)}%` }} /></span></div>
        <div><dt>Licences</dt><dd>{all.length - noLicense.length}<small>/{all.length}</small></dd>
          <span className="progress" aria-hidden="true"><span style={{ width: `${pct(all.length - noLicense.length)}%` }} /></span></div>
        <div><dt>Comptes</dt><dd>{all.filter((r) => r.hasAccount).length}<small>/{all.length}</small></dd></div>
      </dl>

      <section className="card stack">
        <h2>Relances</h2>
        <p className="small"><strong>Cotisation non réglée</strong></p>
        <ReminderForm kind="dues" count={unpaid.filter((r) => r.hasAccount).length} />
        <p className="small"><strong>Licence manquante</strong></p>
        <ReminderForm kind="license" count={noLicense.filter((r) => r.hasAccount).length} />
      </section>

      <section className="card stack">
        <h2>Exports</h2>
        <a href="/bureau/saison/export?type=adherents" className="btn-secondary center" download>Adhérents (CSV)</a>
        <a href="/bureau/saison/export?type=presences" className="btn-secondary center" download>Présences aux entraînements (CSV)</a>
        <p className="muted small">Données personnelles : à conserver au sein du Bureau, et à supprimer une fois utilisées.</p>
      </section>

      <section className="stack">
        <div className="stats-head">
          <h2>Adhérents</h2>
          <nav className="action-row" aria-label="Filtrer">
            {FILTERS.map((f) => (
              <Link key={f.key} href={f.key ? `/bureau/saison?filtre=${f.key}` : "/bureau/saison"} className={filter === f.key ? "chip active" : "chip"}>
                {f.label}
              </Link>
            ))}
          </nav>
        </div>
        {rows.length ? <SeasonRows rows={rows} /> : <p className="notice">Personne dans cette liste.</p>}
      </section>
    </main>
  );
}
