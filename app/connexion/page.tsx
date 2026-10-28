import type { Metadata } from "next";
import Image from "next/image";
import { ZelsyncFooter } from "@/components/ZelsyncFooter";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Connexion" };

export default async function ConnexionPage({
  searchParams,
}: {
  searchParams: Promise<{ erreur?: string }>;
}) {
  const { erreur } = await searchParams;
  return (
    <main className="page page-center">
      <Image
        src="/logo.png"
        alt="Logo du club Volley-Ball Loisirs Saint-Mathieu-de-Tréviers"
        width={160}
        height={160}
        priority
        className="logo-login"
      />
      <h1 className="brand">Volley SMT</h1>
      <p className="muted">Volley-Ball Loisirs Saint-Mathieu-de-Tréviers</p>
      <LoginForm linkError={erreur === "lien"} />
      <p className="muted small">
        Pas de mot de passe : un code vous est envoyé par email. Seuls les adhérents inscrits par
        le Bureau peuvent se connecter.
      </p>
      <ZelsyncFooter />
    </main>
  );
}
