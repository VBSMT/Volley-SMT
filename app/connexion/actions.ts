"use server";

import { createClient } from "@/lib/supabase/server";

export type LoginState = { status: "idle" | "sent" | "error"; message?: string };

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

  // Adresse inconnue : même message que pour une adresse connue (pas de fuite d'information).
  if (error && error.status !== 400 && error.status !== 422) {
    if (error.status === 429) {
      return { status: "error", message: "Trop de demandes. Réessayez dans quelques minutes." };
    }
    return { status: "error", message: "Envoi impossible pour le moment. Réessayez plus tard." };
  }
  return { status: "sent" };
}
