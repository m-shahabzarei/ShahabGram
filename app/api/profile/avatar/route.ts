import { getSessionUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { errorResponse, ok } from "@/lib/api";

export async function POST(request: Request) {
  const user = await getSessionUser(); if (!user) return errorResponse("Unauthorized", 401);
  const form = await request.formData(); const file = form.get("file");
  if (!(file instanceof File)) return errorResponse("Image file is required", 422);
  if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) return errorResponse("Use an image smaller than 5 MB", 422);
  try {
    const db = getSupabaseAdmin(); const ext = file.type.split("/")[1]?.replace(/[^a-z0-9]/gi, "") || "jpg"; const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await db.storage.from("avatars").upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) return errorResponse("Could not upload avatar", 500);
    const { data: publicData } = db.storage.from("avatars").getPublicUrl(path);
    const { data, error } = await db.from("users").update({ avatar_url: publicData.publicUrl }).eq("id", user.id).select("id, username, display_name, bio, avatar_url, language, last_seen_at").single();
    if (error) return errorResponse("Could not save avatar", 500);
    return ok({ user: { id: data.id, username: data.username, displayName: data.display_name, bio: data.bio, avatarUrl: data.avatar_url, language: data.language, lastSeenAt: data.last_seen_at } });
  } catch { return errorResponse("Server is not configured", 503); }
}
