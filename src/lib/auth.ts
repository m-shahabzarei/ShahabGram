import { cookies } from "next/headers";
import { SignJWT } from "jose";
import { getSupabaseAdmin } from "./supabase";
import { createSessionToken, hashSessionToken } from "./crypto";
import type { SessionUser } from "@/types";

const SESSION_COOKIE = "shahabgram_session";
const SESSION_DAYS = 30;

export async function createSession(userId: string) {
  const token = createSessionToken();
  const db = getSupabaseAdmin();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000).toISOString();
  const { data, error } = await db.from("sessions").insert({ user_id: userId, token_hash: hashSessionToken(token), expires_at: expiresAt }).select("id").single();
  if (error) throw error;
  const store = await cookies();
  store.set(SESSION_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", expires: new Date(expiresAt) });
  return { id: data.id as string, expiresAt };
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    const db = getSupabaseAdmin();
    await db.from("sessions").delete().eq("token_hash", hashSessionToken(token));
  }
  store.set(SESSION_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const db = getSupabaseAdmin();
    const { data, error } = await db.from("sessions").select("id, expires_at, users!inner(id, username, display_name, bio, avatar_url, language, last_seen_at)").eq("token_hash", hashSessionToken(token)).gt("expires_at", new Date().toISOString()).maybeSingle();
    if (error || !data) return null;
    await db.from("sessions").update({ last_used_at: new Date().toISOString() }).eq("id", data.id);
    const row = (data as any).users;
    return { sessionId: data.id, id: row.id, username: row.username, displayName: row.display_name, bio: row.bio, avatarUrl: row.avatar_url, language: row.language ?? "fa", lastSeenAt: row.last_seen_at };
  } catch {
    return null;
  }
}

export async function requireSession() {
  const user = await getSessionUser();
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}

export async function createRealtimeToken(userId: string) {
  const secret = process.env.SUPABASE_JWT_SECRET;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!secret || !url) throw new Error("Realtime environment is not configured");
  return new SignJWT({ role: "authenticated", aud: "authenticated" }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setSubject(userId).setIssuer(`${url}/auth/v1`).setIssuedAt().setExpirationTime("10m").sign(new TextEncoder().encode(secret));
}

export const sessionCookieName = SESSION_COOKIE;
