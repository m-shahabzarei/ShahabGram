import { getSessionUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { messageSchema } from "@/lib/validation";
import { errorResponse, ok, parseJson } from "@/lib/api";
import { mapMessage } from "@/lib/mappers";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser(); const { id } = await params; if (!user) return errorResponse("Unauthorized", 401);
  const url = new URL(request.url); const before = url.searchParams.get("before"); const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 30), 1), 50);
  try {
    const db = getSupabaseAdmin(); const { data: member } = await db.from("conversation_members").select("user_id").eq("conversation_id", id).eq("user_id", user.id).maybeSingle(); if (!member) return errorResponse("Forbidden", 403);
    let query = db.from("messages").select("id, conversation_id, sender_id, body, client_id, created_at, edited_at, deleted_at, sender:users(id, username, display_name, bio, avatar_url, language, last_seen_at)").eq("conversation_id", id).order("created_at", { ascending: false }).limit(limit);
    if (before) query = query.lt("created_at", before);
    const { data, error } = await query; if (error) return errorResponse("Could not load messages", 500);
    return ok({ messages: (data ?? []).reverse().map(mapMessage), nextBefore: data && data.length === limit ? data[data.length - 1].created_at : null });
  } catch { return errorResponse("Server is not configured", 503); }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser(); const { id } = await params; if (!user) return errorResponse("Unauthorized", 401);
  const parsed = messageSchema.safeParse(await parseJson(request)); if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message ?? "Invalid message", 422);
  try {
    const db = getSupabaseAdmin(); const { data: member } = await db.from("conversation_members").select("role, conversations!inner(type)").eq("conversation_id", id).eq("user_id", user.id).maybeSingle(); if (!member) return errorResponse("Forbidden", 403);
    const conversation = (member as any).conversations; if (conversation?.type === "channel" && !["owner", "admin"].includes((member as any).role)) return errorResponse("Only channel admins can post", 403);
    const { data: existing } = await db.from("messages").select("id, conversation_id, sender_id, body, client_id, created_at, edited_at, deleted_at, sender:users(id, username, display_name, bio, avatar_url, language, last_seen_at)").eq("conversation_id", id).eq("sender_id", user.id).eq("client_id", parsed.data.clientId).maybeSingle();
    if (existing) return ok({ message: mapMessage(existing), duplicate: true });
    const { data, error } = await db.from("messages").insert({ conversation_id: id, sender_id: user.id, body: parsed.data.body, client_id: parsed.data.clientId }).select("id, conversation_id, sender_id, body, client_id, created_at, edited_at, deleted_at, sender:users(id, username, display_name, bio, avatar_url, language, last_seen_at)").single();
    if (error) return errorResponse("Could not send message", 500); return ok({ message: mapMessage(data) }, { status: 201 });
  } catch { return errorResponse("Server is not configured", 503); }
}
