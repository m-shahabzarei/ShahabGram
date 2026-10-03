import { loginSchema } from "@/lib/validation";
import { verifyPassword } from "@/lib/crypto";
import { createSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { errorResponse, ok, parseJson } from "@/lib/api";

export async function POST(request: Request) {
  const parsed = loginSchema.safeParse(await parseJson(request));
  if (!parsed.success) return errorResponse("Username or password is invalid", 422);
  try {
    const db = getSupabaseAdmin();
    const { data: user } = await db.from("users").select("id, username, display_name, bio, avatar_url, language, last_seen_at, password_hash").eq("username", parsed.data.username).maybeSingle();
    if (!user || !(await verifyPassword(parsed.data.password, user.password_hash))) return errorResponse("Username or password is invalid", 401);
    await db.from("users").update({ last_seen_at: new Date().toISOString() }).eq("id", user.id);
    await createSession(user.id);
    return ok({ user: { id: user.id, username: user.username, displayName: user.display_name, bio: user.bio, avatarUrl: user.avatar_url, language: user.language ?? "fa", lastSeenAt: user.last_seen_at } });
  } catch (error) {
    console.error("login", error);
    return errorResponse("Server is not configured", 503);
  }
}
