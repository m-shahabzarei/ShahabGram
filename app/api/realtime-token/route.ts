import { getSessionUser, createRealtimeToken } from "@/lib/auth";
import { errorResponse, ok } from "@/lib/api";

export async function GET() { const user = await getSessionUser(); if (!user) return errorResponse("Unauthorized", 401); try { return ok({ token: await createRealtimeToken(user.id), expiresIn: 600 }); } catch { return errorResponse("Realtime is not configured", 503); } }
