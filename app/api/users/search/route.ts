import { getSessionUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { errorResponse, ok } from "@/lib/api";
import { mapUser } from "@/lib/mappers";

export async function GET(request: Request) {
  const user = await getSessionUser(); if (!user) return errorResponse("Unauthorized", 401);
  const q = new URL(request.url).searchParams.get("q")?.trim().toLowerCase() ?? "";
  if (q.length < 2) return ok({ users: [] });
  try {
    const db = getSupabaseAdmin();
    const { data, error } = await db.from("users").select("id, username, display_name, bio, avatar_url, language, last_seen_at").or(`username.ilike.%${q}%,display_name.ilike.%${q}%`).neq("id", user.id).order("username").limit(20);
    if (error) return errorResponse("Could not search users", 500);
    return ok({ users: (data ?? []).map(mapUser) });
  } catch { return errorResponse("Server is not configured", 503); }
}
