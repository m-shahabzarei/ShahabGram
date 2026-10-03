import { getSessionUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { profileSchema } from "@/lib/validation";
import { errorResponse, ok, parseJson } from "@/lib/api";

export async function GET() { const user = await getSessionUser(); return user ? ok({ user }) : errorResponse("Unauthorized", 401); }

export async function PATCH(request: Request) {
  const user = await getSessionUser(); if (!user) return errorResponse("Unauthorized", 401);
  const parsed = profileSchema.safeParse(await parseJson(request)); if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message ?? "Invalid profile", 422);
  try {
    const db = getSupabaseAdmin();
    const { data, error } = await db.from("users").update({ display_name: parsed.data.displayName, bio: parsed.data.bio ?? null, language: parsed.data.language ?? user.language }).eq("id", user.id).select("id, username, display_name, bio, avatar_url, language, last_seen_at").single();
    if (error) return errorResponse("Could not update profile", 500);
    return ok({ user: { id: data.id, username: data.username, displayName: data.display_name, bio: data.bio, avatarUrl: data.avatar_url, language: data.language, lastSeenAt: data.last_seen_at } });
  } catch { return errorResponse("Server is not configured", 503); }
}
