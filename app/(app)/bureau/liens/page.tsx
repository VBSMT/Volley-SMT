import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentMember, hasRole } from "@/lib/member";
import { createClient } from "@/lib/supabase/server";
import { LinksEditor } from "./LinksEditor";

export const metadata: Metadata = { title: "Liens utiles · Bureau" };

export default async function BureauLinksPage() {
  if (!hasRole(await getCurrentMember(), "board")) notFound();
  const { data } = await (await createClient()).from("useful_links").select("id, label, url").order("position");
  return (
    <main className="page stack">
      <Link href="/bureau" className="back">← Bureau</Link>
      <h1>Liens utiles</h1>
      <p className="muted small">Visibles par tous les adhérents (page « Liens utiles », depuis l&apos;accueil et le profil).</p>
      <LinksEditor links={data ?? []} />
    </main>
  );
}
