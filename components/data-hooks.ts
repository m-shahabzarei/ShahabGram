"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase";

export type Conversation = { id: string; name: string; handle: string; preview: string; time: string; unread?: number; online?: boolean; initials: string; type?: "direct" | "group" | "channel"; };
export type Message = { id: string; body: string; timestamp: string; author: string; own?: boolean; read?: boolean; clientId?: string; createdAt?: string; };
export type UserPreferences = { language: "fa" | "en"; notifications: boolean; desktopAlerts: boolean; readReceipts: boolean; };
export type SessionUser = { id: string; username: string; displayName: string; bio: string | null; avatarUrl: string | null; language: "fa" | "en"; lastSeenAt: string | null };

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
  useEffect(() => { request<{ user: SessionUser }>("/api/auth/me").then((value) => { currentUserId = value.user.id; setUser(value.user); }).catch(() => { currentUserId = null; setUser(null); }).finally(() => setLoading(false)); }, []);
  return { user, loading, setUser };
}

export function useConversations() {
  const [data, setData] = useState<Conversation[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null);
  const reload = useCallback(() => { setLoading(true); setError(null); return request<{ conversations: any[] }>("/api/conversations").then((value) => setData(value.conversations.map(mapConversation))).catch((reason) => { setData([]); setError(reason instanceof Error ? reason.message : "گفت‌وگوها بارگذاری نشدند"); }).finally(() => setLoading(false)); }, []);
  useEffect(() => { void reload(); }, [reload]);
  return { data, loading, error, reload };
}

export function useMessages(conversationId: string) {
  const [data, setData] = useState<Message[]>([]); const [loading, setLoading] = useState(true); const [sending, setSending] = useState(false); const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setData([]); setLoading(true); setError(null);
    const mergeMessages = (rows: any[]) => {
      const incoming = rows.map(mapMessage);
      setData((previous) => {
        const byKey = new Map(previous.map((item) => [item.id, item]));
        const byClient = new Map(previous.filter((item) => item.clientId).map((item) => [item.clientId as string, item]));
        for (const item of incoming) {
          const optimistic = item.clientId ? byClient.get(item.clientId) : undefined;
          if (optimistic) byKey.delete(optimistic.id);
          byKey.set(item.id, item);
        }
        return [...byKey.values()].sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? ""));
      });
    };
    const sync = () => request<{ messages: any[] }>(`/api/conversations/${conversationId}/messages`).then((value) => { if (active) { mergeMessages(value.messages); setLoading(false); setError(null); } }).catch((reason) => { if (active) { setLoading(false); setError(reason instanceof Error ? reason.message : "پیام‌ها بارگذاری نشدند"); } });
    void sync();
    let channel: any;
    let pollTimer: ReturnType<typeof setInterval> | undefined;
    const supabase = getSupabaseBrowser();
    if (supabase) {
      request<{ token: string }>("/api/realtime-token").then(async ({ token }) => {
        if (!active) return;
        await supabase.realtime.setAuth(token);
        if (!active) return;
        channel = supabase.channel(`messages:${conversationId}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` }, (payload) => {
          const next = mapMessage(payload.new);
          setData((previous) => previous.some((item) => item.id === next.id || (next.clientId && item.clientId === next.clientId)) ? previous : [...previous, next]);
        }).subscribe((status: string, error?: Error) => {
          if (status !== "SUBSCRIBED") console.warn("[ShahabGram] realtime status", status, error?.message ?? "");
          if (!active || status === "SUBSCRIBED") return;
          if (!pollTimer) pollTimer = setInterval(() => { void sync(); }, 2500);
        });
      }).catch(() => { if (active && !pollTimer) pollTimer = setInterval(() => { void sync(); }, 2500); });
    }
    return () => { active = false; if (pollTimer) clearInterval(pollTimer); if (channel) void supabase?.removeChannel(channel); };
  }, [conversationId]);
  const send = useCallback(async (body: string) => { if (!body.trim()) return; setSending(true); const clientId = crypto.randomUUID(); const optimistic: Message = { id: `client-${clientId}`, body: body.trim(), timestamp: "اکنون", author: "شما", own: true, read: false, clientId }; setData((previous) => [...previous, optimistic]); try { const value = await request<{ message: any }>(`/api/conversations/${conversationId}/messages`, { method: "POST", body: JSON.stringify({ body: body.trim(), clientId }) }); setData((previous) => previous.map((item) => item.clientId === clientId ? mapMessage(value.message) : item)); } catch { setData((previous) => previous.filter((item) => item.clientId !== clientId)); throw new Error("پیام ارسال نشد"); } finally { setSending(false); } }, [conversationId]);
  return { data, loading, error, sending, send };
}

export function usePreferences() {
  const [data, setData] = useState<UserPreferences>(defaultPreferences); const [loading, setLoading] = useState(true);
  useEffect(() => { try { const saved = localStorage.getItem("shahabgram_preferences"); if (saved) setData({ ...defaultPreferences, ...JSON.parse(saved) }); } catch { /* ignore */ } finally { setLoading(false); } }, []);
  const update = useCallback(async (partial: Partial<UserPreferences>) => { const next = { ...data, ...partial }; setData(next); localStorage.setItem("shahabgram_preferences", JSON.stringify(next)); return next; }, [data]);
  return { data, loading, update };
}

export function useConversation(conversationId: string) { const { data } = useConversations(); return useMemo(() => data.find((item) => item.id === conversationId), [conversationId, data]); }

