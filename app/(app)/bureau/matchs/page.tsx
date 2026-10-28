import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentMember, hasRole } from "@/lib/member";
import { createClient } from "@/lib/supabase/server";
import { ImportForm } from "./ImportForm";

export const metadata: Metadata = { title: "Calendrier des matchs" };

export default async function BureauMatchsPage() {
  if (!hasRole(await getCurrentMember(), "board")) notFound();

  const supabase = await createClient();
  const [{ count }, { data: lastRun }] = await Promise.all([
    supabase.from("matches").select("id", { count: "exact", head: true }),
    supabase
      .from("sync_runs")
      .select("finished_at, source")
      .eq("success", true)
      .order("finished_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

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
      <ImportForm />
    </main>
  );
}
