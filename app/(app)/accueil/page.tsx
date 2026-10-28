import { createClient } from "@/lib/supabase/server";

export default async function AccueilPage() {
  const supabase = await createClient();
  // RLS : un adhérent ne lit que sa propre fiche.
  const { data: member } = await supabase
    .from("members")
    .select("first_name")
    .maybeSingle();

  return (
    <main className="page stack">
      {member ? (
        <h1>Bonjour {member.first_name}</h1>
      ) : (
        <p className="error" role="alert">
          Votre compte n&apos;est rattaché à aucune fiche adhérent. Contactez le Bureau.
        </p>
      )}
      <form action="/auth/deconnexion" method="post">
        <button type="submit" className="btn-secondary">
          Se déconnecter
        </button>
      </form>
    </main>
  );
}
