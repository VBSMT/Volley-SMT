"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type LoginState = {
  status: "idle" | "sent" | "error";
  email?: string;
  message?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function sendMagicLink(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return { status: "error", message: "Adresse email invalide." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      // Inscription libre désactivée : seuls les comptes importés par le Bureau existent.
      shouldCreateUser: false,
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/confirm`,
    },
  });

  // Adresse inconnue : même réponse que pour une adresse connue (pas de fuite d'information).
  if (error && error.status !== 400 && error.status !== 422) {
    if (error.status === 429) {
      return { status: "error", message: "Trop de demandes. Réessayez dans quelques minutes." };
    }
    return { status: "error", message: "Envoi impossible pour le moment. Réessayez plus tard." };
  }
  return { status: "sent", email };
}

/**
 * Connexion par le code reçu dans l'email : indispensable quand la demande vient de l'appli
 * installée (sur iPhone, le lien s'ouvrirait dans Safari, qui ne partage pas la session).
 */
export async function verifyCode(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const token = String(formData.get("code") ?? "").replace(/\s/g, "");
  if (!/^\d{6,10}$/.test(token)) {
    return { status: "sent", email, message: "Le code est composé de chiffres uniquement." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error) {
    return { status: "sent", email, message: "Code incorrect ou expiré. Demandez un nouveau code." };
  }
  redirect("/accueil");
}
