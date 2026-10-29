import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseAnonKey, supabaseUrl } from "./env";

const PUBLIC_PATHS = ["/connexion", "/auth", "/api/cron"];

/** Rafraîchit la session et renvoie vers /connexion si non connecté. */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // getClaims vérifie la signature du jeton localement (pas d'appel réseau à chaque page)
  // et le rafraîchit si besoin.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims?.sub ?? null;

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/connexion";
    url.search = "";
    return NextResponse.redirect(url);
  }
  if (user && pathname === "/connexion") {
    const url = request.nextUrl.clone();
    url.pathname = "/accueil";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return response;
}
