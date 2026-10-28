import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Cible du lien magique (modèle d'email : supabase/templates/magic_link.html).
 * - token_hash (modèle personnalisé) : fonctionne même si le lien est ouvert dans un autre
 *   navigateur que celui de la demande (cas fréquent sur mobile).
 * - code (modèle par défaut de Supabase) : repli, fonctionne seulement dans le même navigateur.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");

  const supabase = await createClient();
  let error: { message: string } | null = null;

  if (token_hash && type) {
    ({ error } = await supabase.auth.verifyOtp({ type, token_hash }));
  } else if (code) {
    ({ error } = await supabase.auth.exchangeCodeForSession(code));
  } else {
    error = { message: searchParams.get("error_description") ?? "paramètres absents" };
  }

  if (!error) return NextResponse.redirect(`${origin}/accueil`);
  console.error("Échec de connexion par lien magique :", error.message);
  return NextResponse.redirect(`${origin}/connexion?erreur=lien`);
}
