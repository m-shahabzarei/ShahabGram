import { getSessionUser } from "@/lib/auth";
import { errorResponse, ok } from "@/lib/api";
import { mapUser } from "@/lib/mappers";
import { getSupabaseAdmin } from "@/lib/supabase";

const USER_FIELDS = "id, username, display_name, bio, avatar_url, language, is_online, last_seen_at";

/**
 * Return registered users that the current user can start a direct chat with.
 * An empty query intentionally returns the first page, which makes the people
 * picker useful before the user starts typing. The endpoint never exposes
 * password or session fields.
 */
export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return errorResponse("Unauthorized", 401);

  const params = new URL(request.url).searchParams;
  const rawQuery = params.get("q")?.trim() ?? "";
  const query = rawQuery
    // PostgREST's .or() grammar treats these characters as operators. Strip
    // them before interpolating the harmless search term into the filter.
    .replace(/[^\p{L}\p{N}_ .-]/gu, " ")
    .replace(/[\\%_*]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const parsedLimit = Number(params.get("limit") ?? 50);
  const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(Math.trunc(parsedLimit), 1), 100) : 50;

  try {
    const db = getSupabaseAdmin();
    let usersQuery = db
      .from("users")
      .select(USER_FIELDS)
      .neq("id", user.id)
      .order("is_online", { ascending: false })
      .order("username", { ascending: true })
      .limit(limit);
    if (query.length > 0) {
      usersQuery = usersQuery.or(`username.ilike.%${query}%,display_name.ilike.%${query}%`);
    }
    const { data, error } = await usersQuery;
    if (error) return errorResponse("Could not load users", 500);
    return ok({ users: (data ?? []).map(mapUser) });
  } catch {
    return errorResponse("Server is not configured", 503);
  }
}
