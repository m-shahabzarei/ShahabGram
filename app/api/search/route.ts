import { getSessionUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { errorResponse, ok } from "@/lib/api";
import { mapConversation, mapUser } from "@/lib/mappers";

const USER_FIELDS = "id, username, display_name, bio, avatar_url, language, is_online, last_seen_at";
const CONVERSATION_FIELDS = "id, type, title, description, slug, visibility, owner_id, avatar_url, created_at";

function cleanQuery(value: string | null) {
  return (value?.trim() ?? "")
    .replace(/[^\p{L}\p{M}\p{N}_ .\u200c\u200d-]/gu, " ")
    .replace(/[\\%*]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return errorResponse("Unauthorized", 401);

  const rawQuery = new URL(request.url).searchParams.get("q") ?? "";
  const query = cleanQuery(rawQuery);
  // A deliberate empty query opens the directory. A supplied term reduced to
  // punctuation or wildcard characters should not accidentally do the same.
  if (rawQuery.trim() && !/[\p{L}\p{N}]/u.test(query)) return ok({ users: [], publicConversations: [] });
  try {
    const db = getSupabaseAdmin();
    let usersQuery = db
      .from("users")
      .select(USER_FIELDS)
      .neq("id", user.id)
      .order("is_online", { ascending: false })
      .order("username", { ascending: true })
      .limit(50);
    let conversationsQuery = db
      .from("conversations")
      .select(CONVERSATION_FIELDS)
      .in("type", ["group", "channel"])
      .eq("visibility", "public")
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(30);

    if (query) {
      // Quote the PostgREST filter value so its escaped ILIKE pattern reaches
      // PostgreSQL intact. Underscores in identifiers must match literally.
      const pattern = JSON.stringify(`%${query.replace(/_/g, "\\_")}%`);
      usersQuery = usersQuery.or(`username.ilike.${pattern},display_name.ilike.${pattern}`);
      conversationsQuery = conversationsQuery.or(`title.ilike.${pattern},slug.ilike.${pattern},description.ilike.${pattern}`);
    }

    const [{ data: users, error: usersError }, { data: conversations, error: conversationsError }] = await Promise.all([usersQuery, conversationsQuery]);
    if (usersError || conversationsError) return errorResponse("Could not search", 500);
    return ok({ users: (users ?? []).map(mapUser), publicConversations: (conversations ?? []).map(mapConversation) });
  } catch {
    return errorResponse("Server is not configured", 503);
  }
}
