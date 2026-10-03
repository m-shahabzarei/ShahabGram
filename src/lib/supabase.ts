import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function env(name: string) {
  return process.env[name] ?? "";
}

export function getSupabaseAdmin(): SupabaseClient {
  const url = env("NEXT_PUBLIC_SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Supabase server environment is not configured");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export function getSupabaseBrowser() {
  const url = env("NEXT_PUBLIC_SUPABASE_URL");
  const key = env("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export function getSupabaseConfig() {
  return { url: env("NEXT_PUBLIC_SUPABASE_URL"), anonKey: env("NEXT_PUBLIC_SUPABASE_ANON_KEY") };
}
