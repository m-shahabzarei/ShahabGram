import { getSessionUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { errorResponse, ok, parseJson } from "@/lib/api";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser(); const { id } = await params; if (!user) return errorResponse("Unauthorized", 401); const body = await parseJson(request); const userId = typeof body?.userId === "string" ? body.userId : "";
  if (!userId) return errorResponse("userId is required", 422);
  try { const db = getSupabaseAdmin(); const { data: me } = await db.from("conversation_members").select("role").eq("conversation_id", id).eq("user_id", user.id).maybeSingle(); if (!me || !["owner", "admin"].includes(me.role)) return errorResponse("Forbidden", 403); const { error } = await db.from("conversation_members").upsert({ conversation_id: id, user_id: userId, role: "member", left_at: null }, { onConflict: "conversation_id,user_id" }); if (error) return errorResponse("Could not add member", 500); return ok({ ok: true }, { status: 201 }); } catch { return errorResponse("Server is not configured", 503); }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser(); const { id } = await params; if (!user) return errorResponse("Unauthorized", 401); const body = await parseJson(request); const userId = typeof body?.userId === "string" ? body.userId : "";
  if (!userId) return errorResponse("userId is required", 422);
  try { const db = getSupabaseAdmin(); const { data: me } = await db.from("conversation_members").select("role").eq("conversation_id", id).eq("user_id", user.id).maybeSingle(); if (!me || !["owner", "admin"].includes(me.role)) return errorResponse("Forbidden", 403); const { error } = await db.from("conversation_members").update({ left_at: new Date().toISOString() }).eq("conversation_id", id).eq("user_id", userId); if (error) return errorResponse("Could not remove member", 500); return ok({ ok: true }); } catch { return errorResponse("Server is not configured", 503); }
}
