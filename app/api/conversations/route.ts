import { getSessionUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { conversationSchema } from "@/lib/validation";
import { errorResponse, ok, parseJson } from "@/lib/api";
import { mapConversation, mapMessage, mapUser } from "@/lib/mappers";

export async function GET() {
  const user = await getSessionUser(); if (!user) return errorResponse("Unauthorized", 401);
  try {
    const db = getSupabaseAdmin();
    const { data: memberships, error } = await db.from("conversation_members").select("conversation_id, last_read_message_id, conversations!inner(id, type, title, description, slug, visibility, owner_id, avatar_url, created_at)").eq("user_id", user.id).order("joined_at", { ascending: false });
    if (error) return errorResponse("Could not load conversations", 500);
    const ids = (memberships ?? []).map((row: any) => row.conversation_id);
    const { data: latest } = ids.length ? await db.from("messages").select("id, conversation_id, sender_id, body, client_id, created_at, edited_at, deleted_at, sender:users(id, username, display_name, bio, avatar_url, language, last_seen_at)").in("conversation_id", ids).is("deleted_at", null).order("created_at", { ascending: false }).limit(Math.max(50, ids.length * 3)) : { data: [] as any[] };
    const conversations = await Promise.all((memberships ?? []).map(async (row: any) => {
      const conv = mapConversation(row.conversations);
      const lastMessage = (latest ?? []).find((message: any) => message.conversation_id === conv.id);
      let unreadCount = 0;
      let countQuery = db.from("messages").select("id", { count: "exact", head: true }).eq("conversation_id", conv.id).neq("sender_id", user.id);
      if (row.last_read_message_id) {
        const { data: marker } = await db.from("messages").select("created_at").eq("id", row.last_read_message_id).maybeSingle();
        if (marker?.created_at) countQuery = countQuery.gt("created_at", marker.created_at);
      }
      const result = await countQuery;
      unreadCount = result.count ?? 0;
      return { ...conv, lastMessage: lastMessage ? mapMessage(lastMessage) : null, unreadCount };
    }));
    return ok({ conversations });
  } catch { return errorResponse("Server is not configured", 503); }
}

export async function POST(request: Request) {
  const user = await getSessionUser(); if (!user) return errorResponse("Unauthorized", 401);
  const parsed = conversationSchema.safeParse(await parseJson(request)); if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message ?? "Invalid conversation", 422);
  const input = parsed.data;
  if (input.type === "direct" && input.memberIds.length !== 1) return errorResponse("A direct conversation needs one other user", 422);
  if (input.type === "channel" && input.memberIds.length > 0) return errorResponse("Channels add members after creation", 422);
  try {
    const db = getSupabaseAdmin();
    if (input.type === "direct") {
      const other = input.memberIds[0]; const directKey = [user.id, other].sort().join(":");
      const { data: existing } = await db.from("conversations").select("id, type, title, description, slug, visibility, owner_id, avatar_url, created_at").eq("direct_key", directKey).maybeSingle();
      if (existing) return ok({ conversation: mapConversation(existing) });
      input.title = input.title || "Direct chat";
      const { data: created, error } = await db.from("conversations").insert({ type: "direct", title: input.title, owner_id: user.id, visibility: "private", direct_key: directKey }).select("id, type, title, description, slug, visibility, owner_id, avatar_url, created_at").single();
      if (error) return errorResponse("Could not create conversation", 500);
      await db.from("conversation_members").insert([{ conversation_id: created.id, user_id: user.id, role: "owner" }, { conversation_id: created.id, user_id: other, role: "member" }]);
      return ok({ conversation: mapConversation(created) }, { status: 201 });
    }
    const { data: created, error } = await db.from("conversations").insert({ type: input.type, title: input.title, description: input.description ?? null, slug: input.slug ?? null, visibility: input.visibility, owner_id: user.id }).select("id, type, title, description, slug, visibility, owner_id, avatar_url, created_at").single();
    if (error) return errorResponse(error.code === "23505" ? "Slug is already in use" : "Could not create conversation", error.code === "23505" ? 409 : 500);
    const memberIds = Array.from(new Set([user.id, ...input.memberIds]));
    const rows = memberIds.map((id) => ({ conversation_id: created.id, user_id: id, role: id === user.id ? "owner" : "member" }));
    await db.from("conversation_members").insert(rows);
    return ok({ conversation: mapConversation(created) }, { status: 201 });
  } catch { return errorResponse("Server is not configured", 503); }
}
