import { getSessionUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { errorResponse, ok } from "@/lib/api";
import { mapConversation } from "@/lib/mappers";

const CONVERSATION_FIELDS = "id, type, title, description, slug, visibility, owner_id, avatar_url, created_at";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  const { id } = await params;
  if (!user) return errorResponse("Unauthorized", 401);

  try {
    const db = getSupabaseAdmin();
    const { data: conversation, error: conversationError } = await db
      .from("conversations")
      .select(CONVERSATION_FIELDS)
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    if (conversationError) return errorResponse("Could not load conversation", 500);
    if (!conversation) return errorResponse("Conversation not found", 404);
    if (conversation.visibility !== "public" || !["group", "channel"].includes(conversation.type)) return errorResponse("Only public groups and channels can be joined", 403);

    const { data: existing, error: existingError } = await db
      .from("conversation_members")
      .select("role, left_at")
      .eq("conversation_id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (existingError) return errorResponse("Could not check membership", 500);

    if (existing?.left_at) {
      const { error } = await db.from("conversation_members").update({ left_at: null }).eq("conversation_id", id).eq("user_id", user.id);
      if (error) return errorResponse("Could not join conversation", 500);
    } else if (!existing) {
      // Another join may have created the membership after the check. Ignore
      // that conflict rather than replacing its role or failing the request.
      const { error } = await db.from("conversation_members").upsert({ conversation_id: id, user_id: user.id, role: "member" }, { onConflict: "conversation_id,user_id", ignoreDuplicates: true });
      if (error) return errorResponse("Could not join conversation", 500);
      // Reactivate a membership inserted by a concurrent request without
      // changing an owner/admin role or the original join timestamp.
      const { error: reactivateError } = await db.from("conversation_members").update({ left_at: null }).eq("conversation_id", id).eq("user_id", user.id);
      if (reactivateError) return errorResponse("Could not join conversation", 500);
    }

    return ok({ conversation: mapConversation(conversation) }, { status: existing ? 200 : 201 });
  } catch {
    return errorResponse("Server is not configured", 503);
  }
}
