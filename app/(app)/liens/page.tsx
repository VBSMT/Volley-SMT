import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Liens utiles" };

const DEFAULT_LINKS = [
  { id: "v34", label: "volley34.fr : calendriers, classements, résultats", url: "https://www.volley34.fr" },
];

export default async function LinksPage() {
  const { data } = await (await createClient()).from("useful_links").select("id, label, url").order("position");
  const links = data?.length ? data : DEFAULT_LINKS;
  return (
    <main className="page stack">
      <h1>Liens utiles</h1>
      <ul className="list">
        {links.map((l) => (
          <li key={l.id}>
            <a href={l.url} target="_blank" rel="noopener noreferrer" className="card card-link link-card">
              <span>{l.label}</span>
              <span aria-hidden="true">↗</span>
            </a>
          </li>
        ))}
      </ul>
    </main>
  );
}
