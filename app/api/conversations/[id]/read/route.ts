import { getSessionUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { errorResponse, ok, parseJson } from "@/lib/api";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser(); const { id } = await params; if (!user) return errorResponse("Unauthorized", 401); const body = await parseJson(request); const messageId = typeof body?.messageId === "string" ? body.messageId : "";
  if (!messageId) return errorResponse("messageId is required", 422);
  try { const db = getSupabaseAdmin(); const { error } = await db.from("conversation_members").update({ last_read_message_id: messageId }).eq("conversation_id", id).eq("user_id", user.id); if (error) return errorResponse("Could not mark as read", 500); return ok({ ok: true }); } catch { return errorResponse("Server is not configured", 503); }
}
