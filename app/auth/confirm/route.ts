import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Cible du lien magique (modèle d'email : supabase/templates/magic_link.html).
 * On vérifie un token_hash plutôt qu'un code PKCE : le lien fonctionne même s'il est
 * ouvert dans un autre navigateur que celui de la demande (cas fréquent sur mobile).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) return NextResponse.redirect(`${origin}/accueil`);
  }
  return NextResponse.redirect(`${origin}/connexion?erreur=lien`);
}
