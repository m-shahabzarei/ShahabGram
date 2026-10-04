import { getSessionUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { errorResponse, ok, parseJson } from "@/lib/api";
import { z } from "zod";

const readSchema = z.object({ messageId: z.string().uuid() });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return errorResponse("Unauthorized", 401);
  const { id } = await params;
  const parsed = readSchema.safeParse(await parseJson(request));
  if (!parsed.success) return errorResponse("A valid messageId is required", 422);
  const { messageId } = parsed.data;

  try {
    const db = getSupabaseAdmin();
    const loadMember = () => db.from("conversation_members").select("last_read_message_id").eq("conversation_id", id).eq("user_id", user.id).is("left_at", null).maybeSingle();
    let membership = await loadMember();
    if (membership.error) return errorResponse("Could not load membership", 500);
    if (!membership.data) return errorResponse("Forbidden", 403);
    const { data: message, error: messageError } = await db.from("messages").select("created_at").eq("id", messageId).eq("conversation_id", id).maybeSingle();
    if (messageError) return errorResponse("Could not load message", 500);
    if (!message) return errorResponse("Message not found", 404);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const previousId = membership.data.last_read_message_id;
      if (previousId === messageId) return ok({ ok: true });
      if (previousId) {
        // Deleted messages retain their timestamp and remain valid read markers.
        const { data: previous, error } = await db.from("messages").select("id").eq("id", previousId).eq("conversation_id", id).gte("created_at", message.created_at).maybeSingle();
        if (error) return errorResponse("Could not load read marker", 500);
        if (previous) return ok({ ok: true });
      }
      let update = db.from("conversation_members").update({ last_read_message_id: messageId }).eq("conversation_id", id).eq("user_id", user.id).is("left_at", null);
      // Compare-and-set prevents a slower tab/request overwriting a newer read.
      update = previousId ? update.eq("last_read_message_id", previousId) : update.is("last_read_message_id", null);
      const { data: updated, error } = await update.select("last_read_message_id").maybeSingle();
      if (error) return errorResponse("Could not mark as read", 500);
      if (updated) return ok({ ok: true });
      membership = await loadMember();
      if (membership.error) return errorResponse("Could not load membership", 500);
      if (!membership.data) return errorResponse("Forbidden", 403);
    }
    return errorResponse("Read marker changed; please retry", 409);
  } catch {
    return errorResponse("Server is not configured", 503);
  }
}
