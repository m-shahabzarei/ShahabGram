import { registerSchema } from "@/lib/validation";
import { hashPassword } from "@/lib/crypto";
import { createSession } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { errorResponse, ok, parseJson } from "@/lib/api";

export async function POST(request: Request) {
  const parsed = registerSchema.safeParse(await parseJson(request));
  if (!parsed.success) return errorResponse(parsed.error.issues[0]?.message ?? "Invalid registration", 422);
  try {
    const db = getSupabaseAdmin();
    const username = parsed.data.username;
    const { data: existing } = await db.from("users").select("id").eq("username", username).maybeSingle();
    if (existing) return errorResponse("Username is already in use", 409);
    const { data: user, error } = await db.from("users").insert({ username, password_hash: await hashPassword(parsed.data.password), display_name: parsed.data.displayName ?? username }).select("id, username, display_name, bio, avatar_url, language, last_seen_at").single();
    if (error) return errorResponse(error.code === "23505" ? "Username is already in use" : "Could not create account", error.code === "23505" ? 409 : 500);
    await createSession(user.id);
    return ok({ user: { id: user.id, username: user.username, displayName: user.display_name, bio: user.bio, avatarUrl: user.avatar_url, language: user.language ?? "fa", lastSeenAt: user.last_seen_at } }, { status: 201 });
  } catch (error) {
    console.error("register", error);
    return errorResponse("Server is not configured", 503);
  }
}
