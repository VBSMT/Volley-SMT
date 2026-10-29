import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseUrl } from "./env";

/**
 * Client « service_role » : contourne la RLS. Réservé aux tâches serveur
 * (envoi des notifications, enregistrement des abonnements push). Jamais côté navigateur.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY manquante");
  return createClient(supabaseUrl, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
