import { getSessionUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { errorResponse, ok, parseJson } from "@/lib/api";
import { mapConversation } from "@/lib/mappers";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser(); const { id } = await params; if (!user) return errorResponse("Unauthorized", 401);
  try {
    const db = getSupabaseAdmin();
    const { data: member } = await db.from("conversation_members").select("role, last_read_message_id").eq("conversation_id", id).eq("user_id", user.id).is("left_at", null).maybeSingle();
    if (!member) return errorResponse("Conversation not found", 404);
    const { data: row, error } = await db.from("conversations").select("id, type, title, description, slug, visibility, owner_id, avatar_url, created_at").eq("id", id).single();
    if (error || !row) return errorResponse("Conversation not found", 404);
    const { data: members } = await db.from("conversation_members").select("conversation_id, user_id, role, joined_at, last_read_message_id, user:users(id, username, display_name, bio, avatar_url, language, is_online, last_seen_at)").eq("conversation_id", id).is("left_at", null).order("joined_at");
    const counterpart: any = row.type === "direct" ? (members ?? []).find((item: any) => item.user_id !== user.id)?.user : null;
    const mappedConversation = mapConversation(counterpart ? { ...row, title: counterpart.display_name ?? counterpart.username, avatar_url: counterpart.avatar_url } : row);
    return ok({ conversation: { ...mappedConversation, role: member.role, members: (members ?? []).map((m: any) => ({ conversationId: id, userId: m.user_id, role: m.role, joinedAt: m.joined_at, lastReadMessageId: m.last_read_message_id, user: m.user })) } });
  } catch { return errorResponse("Server is not configured", 503); }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser(); const { id } = await params; if (!user) return errorResponse("Unauthorized", 401);
  const body = await parseJson(request); const title = typeof body?.title === "string" ? body.title.trim().slice(0, 100) : undefined; const description = typeof body?.description === "string" ? body.description.trim().slice(0, 500) : undefined;
  if (!title && description === undefined) return errorResponse("Nothing to update", 422);
  try {
    const db = getSupabaseAdmin(); const { data: member } = await db.from("conversation_members").select("role").eq("conversation_id", id).eq("user_id", user.id).maybeSingle();
    if (!member || !["owner", "admin"].includes(member.role)) return errorResponse("Forbidden", 403);
    const { data, error } = await db.from("conversations").update({ ...(title ? { title } : {}), ...(description !== undefined ? { description } : {}) }).eq("id", id).select("id, type, title, description, slug, visibility, owner_id, avatar_url, created_at").single();
    if (error) return errorResponse("Could not update conversation", 500); return ok({ conversation: mapConversation(data) });
  } catch { return errorResponse("Server is not configured", 503); }
}
