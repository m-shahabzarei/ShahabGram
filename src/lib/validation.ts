import { z } from "zod";

export const usernameSchema = z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,32}$/, "Username must be 3-32 lowercase letters, numbers or underscores");
export const passwordSchema = z.string().min(8, "Password must be at least 8 characters").max(128);
export const registerSchema = z.object({ username: usernameSchema, password: passwordSchema, displayName: z.string().trim().min(1).max(80).optional() });
export const loginSchema = z.object({ username: usernameSchema, password: passwordSchema });
export const profileSchema = z.object({ displayName: z.string().trim().min(1).max(80), bio: z.string().trim().max(280).optional(), language: z.enum(["fa", "en"]).optional() });
export const messageSchema = z.object({ body: z.string().trim().min(1).max(4000), clientId: z.string().trim().min(8).max(128) });
export const conversationSchema = z.object({
  type: z.enum(["direct", "group", "channel"]),
  title: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).optional(),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,48}$/).optional(),
  visibility: z.enum(["public", "private"]).default("private"),
  memberIds: z.array(z.string().uuid()).max(500).default([]),
});
export const readSchema = z.object({ messageId: z.string().uuid() });

export function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}
