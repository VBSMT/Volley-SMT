import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentMember, hasRole } from "@/lib/member";
import { createClient } from "@/lib/supabase/server";
import { ImportForm } from "./ImportForm";
import { SyncButton } from "./SyncButton";

export const metadata: Metadata = { title: "Calendrier des matchs" };

export default async function BureauMatchsPage() {
  if (!hasRole(await getCurrentMember(), "board")) notFound();

  const supabase = await createClient();
  const [{ count }, { data: lastRun }, { data: lastVolley34 }] = await Promise.all([
    supabase.from("matches").select("id", { count: "exact", head: true }),
    supabase
      .from("sync_runs")
      .select("finished_at, source")
      .eq("success", true)
      .order("finished_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("sync_runs")
      .select("finished_at, success, message")
      .eq("source", "volley34")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const at = (iso: string) =>
    new Date(iso).toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "short", timeStyle: "short" });

  return (
    <main className="page stack">
      <Link href="/bureau" className="back">← Bureau</Link>
      <h1>Calendrier des matchs</h1>
      <p className="muted">
        {count ?? 0} matchs enregistrés
        {lastRun?.finished_at &&
          ` · dernière mise à jour le ${new Date(lastRun.finished_at).toLocaleString("fr-FR", {
            timeZone: "Europe/Paris",
            dateStyle: "short",
            timeStyle: "short",
          })}`}
      </p>
      <section className="card stack">
        <h2>Synchro volley34</h2>
        <p className="muted small">
          Chaque jour vers 6h, dates et lieux des matchs sont mis à jour depuis volley34.fr
          (accord de la commission). volley34 fait foi pour les dates.
        </p>
        {lastVolley34 ? (
          <p className={lastVolley34.success ? "small" : "error small"}>
            Dernière synchro le {at(lastVolley34.finished_at!)} : {lastVolley34.success ? "réussie" : "en échec"}
            {lastVolley34.message && ` — ${lastVolley34.message.split(" · ⚠")[0]}`}
          </p>
        ) : (
          <p className="small">Aucune synchro pour l&apos;instant.</p>
        )}
        {lastVolley34?.message?.includes(" · ⚠") && (
          <p className="notice small" role="status">
            ⚠ {lastVolley34.message.split(" · ⚠ ")[1].replace(/\s*\[non lus:[^\]]*\]$/, "")}. Ces matchs ne sont pas
            mis à jour automatiquement : vérifiez-les sur volley34 et signalez la formulation pour que la synchro la reconnaisse.
          </p>
        )}
        <SyncButton />
      </section>
      <ImportForm />
    </main>
  );
}
