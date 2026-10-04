import { getSessionUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { conversationSchema } from "@/lib/validation";
import { errorResponse, ok, parseJson } from "@/lib/api";
import { mapConversation, mapMessage, mapUser } from "@/lib/mappers";

async function ensureDirectMembers(db: any, conversationId: string, ownerId: string, otherId: string) {
  const { error } = await db.from("conversation_members").upsert([
    { conversation_id: conversationId, user_id: ownerId, role: "owner" },
    { conversation_id: conversationId, user_id: otherId, role: "member" },
  ], { onConflict: "conversation_id,user_id", ignoreDuplicates: true });
  if (error) return error;
  // A participant may have left a previous direct chat. Starting it again
  // should reactivate that membership while preserving its existing role.
  const { error: reactivateError } = await db.from("conversation_members").update({ left_at: null }).eq("conversation_id", conversationId).in("user_id", [ownerId, otherId]);
  return reactivateError;
}

export async function GET() {
  const user = await getSessionUser(); if (!user) return errorResponse("Unauthorized", 401);
  try {
    const db = getSupabaseAdmin();
    const { data: memberships, error } = await db.from("conversation_members").select("conversation_id, last_read_message_id, conversations!inner(id, type, title, description, slug, visibility, owner_id, avatar_url, created_at)").eq("user_id", user.id).is("left_at", null).order("joined_at", { ascending: false });
    if (error) return errorResponse("Could not load conversations", 500);
    const ids = (memberships ?? []).map((row: any) => row.conversation_id);
    const directIds = (memberships ?? []).filter((row: any) => row.conversations?.type === "direct").map((row: any) => row.conversation_id);
    const { data: directMembers } = directIds.length ? await db.from("conversation_members").select("conversation_id, user_id, user:users(id, username, display_name, bio, avatar_url, language, is_online, last_seen_at)").in("conversation_id", directIds).neq("user_id", user.id).is("left_at", null) : { data: [] as any[] };
    const counterpartByConversation = new Map<string, any>((directMembers ?? []).map((row: any) => [row.conversation_id, row.user]));
    const { data: latest } = ids.length ? await db.from("messages").select("id, conversation_id, sender_id, body, client_id, created_at, edited_at, deleted_at, sender:users(id, username, display_name, bio, avatar_url, language, is_online, last_seen_at)").in("conversation_id", ids).is("deleted_at", null).order("created_at", { ascending: false }).limit(Math.max(50, ids.length * 3)) : { data: [] as any[] };
    const conversations = await Promise.all((memberships ?? []).map(async (row: any) => {
      const counterpart = counterpartByConversation.get(row.conversation_id);
      const conv = mapConversation(counterpart ? { ...row.conversations, title: counterpart.display_name ?? counterpart.username, avatar_url: counterpart.avatar_url } : row.conversations);
      const lastMessage = (latest ?? []).find((message: any) => message.conversation_id === conv.id);
      let unreadCount = 0;
      let countQuery = db.from("messages").select("id", { count: "exact", head: true }).eq("conversation_id", conv.id).neq("sender_id", user.id).is("deleted_at", null);
      if (row.last_read_message_id) {
        const { data: marker, error: markerError } = await db.from("messages").select("created_at").eq("id", row.last_read_message_id).eq("conversation_id", conv.id).maybeSingle();
        if (markerError) throw new Error("Could not load read marker");
        if (marker?.created_at) countQuery = countQuery.gt("created_at", marker.created_at);
      }
      const result = await countQuery;
      if (result.error) throw new Error("Could not count unread messages");
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
  if (input.type !== "direct" && !input.title) return errorResponse("A title is required", 422);
  if (input.type === "direct" && input.memberIds[0] === user.id) return errorResponse("You cannot start a conversation with yourself", 422);
  try {
    const db = getSupabaseAdmin();
    if (input.type === "direct") {
      const other = input.memberIds[0]; const directKey = [user.id, other].sort().join(":");
      const { data: otherUser, error: otherUserError } = await db.from("users").select("id, username, display_name, bio, avatar_url, language, is_online, last_seen_at").eq("id", other).maybeSingle();
      if (otherUserError) return errorResponse("Could not find user", 500);
      if (!otherUser) return errorResponse("User not found", 404);

      const conversationFields = "id, type, title, description, slug, visibility, owner_id, avatar_url, created_at";
      const { data: existing } = await db.from("conversations").select(conversationFields).eq("direct_key", directKey).is("deleted_at", null).maybeSingle();
      if (existing) {
        // Ensure both sides are members even if an earlier request was
        // interrupted between creating the conversation and its memberships.
        const memberError = await ensureDirectMembers(db, existing.id, existing.owner_id, other);
        if (memberError) return errorResponse("Could not add conversation members", 500);
        return ok({ conversation: mapConversation({ ...existing, title: otherUser.display_name ?? otherUser.username, avatar_url: otherUser.avatar_url }) });
      }

      const { data: created, error } = await db.from("conversations").insert({ type: "direct", title: otherUser.display_name ?? otherUser.username, owner_id: user.id, visibility: "private", direct_key: directKey, avatar_url: otherUser.avatar_url ?? null }).select(conversationFields).single();
      if (error) {
        // A concurrent request may have won the direct_key unique index.
        if (error.code === "23505") {
          const { data: concurrent } = await db.from("conversations").select(conversationFields).eq("direct_key", directKey).is("deleted_at", null).maybeSingle();
          if (concurrent) {
            const memberError = await ensureDirectMembers(db, concurrent.id, concurrent.owner_id, other);
            if (memberError) return errorResponse("Could not add conversation members", 500);
            return ok({ conversation: mapConversation({ ...concurrent, title: otherUser.display_name ?? otherUser.username, avatar_url: otherUser.avatar_url }) });
          }
        }
        return errorResponse("Could not create conversation", 500);
      }
      const membersError = await ensureDirectMembers(db, created.id, user.id, other);
      if (membersError) return errorResponse("Could not add conversation members", 500);
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
