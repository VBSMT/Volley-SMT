"use client";

import { createBrowserClient } from "@supabase/ssr";
import { supabaseAnonKey, supabaseUrl } from "./env";

/** Client navigateur (session lue dans les cookies) : sert au temps réel de la messagerie. */
let client: ReturnType<typeof createBrowserClient> | null = null;
export function getBrowserClient() {
  client ??= createBrowserClient(supabaseUrl, supabaseAnonKey);
  return client;
}
