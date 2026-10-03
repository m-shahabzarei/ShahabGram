"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase";

export type Conversation = { id: string; name: string; handle: string; preview: string; time: string; unread?: number; online?: boolean; initials: string; type?: "direct" | "group" | "channel"; };
export type Message = { id: string; body: string; timestamp: string; author: string; own?: boolean; read?: boolean; clientId?: string; createdAt?: string; };
export type UserPreferences = { language: "fa" | "en"; notifications: boolean; desktopAlerts: boolean; readReceipts: boolean; };
export type SessionUser = { id: string; username: string; displayName: string; bio: string | null; avatarUrl: string | null; language: "fa" | "en"; lastSeenAt: string | null };

const fallbackConversations: Conversation[] = [
  { id: "niloofar", name: "نیلوفر احمدی", handle: "@niloofar", preview: "برای ارائه فردا آماده‌ای؟", time: "۱۰:۴۲", unread: 2, online: true, initials: "ن", type: "direct" },
  { id: "product", name: "تیم محصول", handle: "۱۲ عضو", preview: "مریم: نسخه جدید آماده شد.", time: "۰۹:۱۸", unread: 7, initials: "ت", type: "group" },
  { id: "omid", name: "امید رضایی", handle: "@omid", preview: "لینک فایل را همین‌جا می‌فرستم.", time: "دیروز", online: true, initials: "ا", type: "direct" },
];
const fallbackMessages: Record<string, Message[]> = { niloofar: [{ id: "m1", body: "سلام! برای ارائه فردا آماده‌ای؟", timestamp: "۱۰:۳۷", author: "نیلوفر احمدی" }, { id: "m2", body: "سلام نیلوفر، بله. اسلایدهای بخش آخر را هم بازبینی کردم.", timestamp: "۱۰:۳۹", author: "شهاب", own: true, read: true }, { id: "m3", body: "عالیه. پس ساعت ۹ یک مرور کوتاه داشته باشیم؟", timestamp: "۱۰:۴۰", author: "نیلوفر احمدی" }], product: [{ id: "p1", body: "نسخه جدید آماده شد. لطفاً روی محیط آزمایشی بررسی کنید.", timestamp: "۰۹:۰۸", author: "مریم" }] };
const defaultPreferences: UserPreferences = { language: "fa", notifications: true, desktopAlerts: false, readReceipts: true };
let currentUserId: string | null = null;

async function request<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error ?? "Request failed");
  return body as T;
}
function initials(value: string) { return value.trim().slice(0, 1) || "؟"; }
function timeLabel(value?: string | null) { if (!value) return ""; try { return new Intl.DateTimeFormat("fa-IR", { hour: "2-digit", minute: "2-digit" }).format(new Date(value)); } catch { return ""; } }
function mapConversation(row: any): Conversation { return { id: row.id, name: row.title, handle: row.type === "direct" ? "گفت‌وگوی خصوصی" : row.visibility === "public" && row.slug ? `@${row.slug}` : row.type === "channel" ? "کانال" : "گروه", preview: row.lastMessage?.body ?? "هنوز پیامی ارسال نشده", time: timeLabel(row.lastMessage?.createdAt ?? row.createdAt), unread: row.unreadCount ?? 0, initials: initials(row.title), type: row.type }; }
function mapMessage(row: any): Message { const created = row.createdAt ?? row.created_at; const sender = row.sender?.displayName ?? row.sender?.display_name ?? row.author ?? "کاربر"; return { id: row.id, body: row.body ?? row.content ?? "", timestamp: timeLabel(created), createdAt: created, author: sender, own: currentUserId ? row.senderId === currentUserId || row.sender_id === currentUserId : row.own, read: true, clientId: row.clientId ?? row.client_id }; }

export function useSessionUser() {
  const [user, setUser] = useState<SessionUser | null>(null); const [loading, setLoading] = useState(true);
  useEffect(() => { request<{ user: SessionUser }>("/api/auth/me").then((value) => { currentUserId = value.user.id; setUser(value.user); }).catch(() => setUser(null)).finally(() => setLoading(false)); }, []);
  return { user, loading, setUser };
}

export function useConversations() {
  const [data, setData] = useState<Conversation[]>([]); const [loading, setLoading] = useState(true);
  const reload = useCallback(() => { setLoading(true); return request<{ conversations: any[] }>("/api/conversations").then((value) => setData(value.conversations.map(mapConversation))).catch(() => setData(fallbackConversations)).finally(() => setLoading(false)); }, []);
  useEffect(() => { void reload(); }, [reload]);
  return { data, loading, reload };
}

export function useMessages(conversationId: string) {
  const [data, setData] = useState<Message[]>([]); const [loading, setLoading] = useState(true); const [sending, setSending] = useState(false);
  useEffect(() => {
    let active = true;
    request<{ messages: any[] }>(`/api/conversations/${conversationId}/messages`).then((value) => { if (active) setData(value.messages.map(mapMessage)); }).catch(() => { if (active) setData(fallbackMessages[conversationId] ?? []); }).finally(() => { if (active) setLoading(false); });
    let channel: any;
    const supabase = getSupabaseBrowser();
    if (supabase) {
      request<{ token: string }>("/api/realtime-token").then(({ token }) => { if (!active) return; supabase.realtime.setAuth(token); channel = supabase.channel(`messages:${conversationId}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` }, (payload) => { const next = mapMessage(payload.new); setData((previous) => previous.some((item) => item.id === next.id || (next.clientId && item.clientId === next.clientId)) ? previous : [...previous, next]); }).subscribe(); }).catch(() => undefined);
    }
    return () => { active = false; if (channel) void supabase?.removeChannel(channel); };
  }, [conversationId]);
  const send = useCallback(async (body: string) => { if (!body.trim()) return; setSending(true); const clientId = crypto.randomUUID(); const optimistic: Message = { id: `client-${clientId}`, body: body.trim(), timestamp: "اکنون", author: "شما", own: true, read: false, clientId }; setData((previous) => [...previous, optimistic]); try { const value = await request<{ message: any }>(`/api/conversations/${conversationId}/messages`, { method: "POST", body: JSON.stringify({ body: body.trim(), clientId }) }); setData((previous) => previous.map((item) => item.clientId === clientId ? mapMessage(value.message) : item)); } catch { setData((previous) => previous.filter((item) => item.clientId !== clientId)); throw new Error("پیام ارسال نشد"); } finally { setSending(false); } }, [conversationId]);
  return { data, loading, sending, send };
}

export function usePreferences() {
  const [data, setData] = useState<UserPreferences>(defaultPreferences); const [loading, setLoading] = useState(true);
  useEffect(() => { try { const saved = localStorage.getItem("shahabgram_preferences"); if (saved) setData({ ...defaultPreferences, ...JSON.parse(saved) }); } catch { /* ignore */ } finally { setLoading(false); } }, []);
  const update = useCallback(async (partial: Partial<UserPreferences>) => { const next = { ...data, ...partial }; setData(next); localStorage.setItem("shahabgram_preferences", JSON.stringify(next)); return next; }, [data]);
  return { data, loading, update };
}

export function useConversation(conversationId: string) { const { data } = useConversations(); return useMemo(() => data.find((item) => item.id === conversationId) ?? fallbackConversations.find((item) => item.id === conversationId), [conversationId, data]); }

