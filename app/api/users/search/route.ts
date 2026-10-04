import { getSessionUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { errorResponse, ok } from "@/lib/api";
import { mapUser } from "@/lib/mappers";

export async function GET(request: Request) {
  const user = await getSessionUser(); if (!user) return errorResponse("Unauthorized", 401);
  const q = (new URL(request.url).searchParams.get("q")?.trim().toLowerCase() ?? "")
    .replace(/[^\p{L}\p{N}_ .-]/gu, " ")
    .replace(/[\\%_*]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  try {
    const db = getSupabaseAdmin();
    // An empty query is useful for the people directory shown when Search opens.
    // Keep the minimum length rule for filtered searches so a single character
    // does not result in an unexpectedly large query.
    if (q.length === 1) return ok({ users: [] });
    let query = db.from("users").select("id, username, display_name, bio, avatar_url, language, is_online, last_seen_at").neq("id", user.id).order("is_online", { ascending: false }).order("username");
    if (q.length >= 2) query = query.or(`username.ilike.%${q}%,display_name.ilike.%${q}%`).limit(20);
    else query = query.limit(100);
    const { data, error } = await query;
    if (error) return errorResponse("Could not search users", 500);
    return ok({ users: (data ?? []).map(mapUser) });
  } catch { return errorResponse("Server is not configured", 503); }
}
