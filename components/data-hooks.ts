"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase";

export type Conversation = { id: string; name: string; handle: string; preview: string; time: string; unread?: number; online?: boolean; initials: string; type?: "direct" | "group" | "channel"; };
export type Message = { id: string; body: string; timestamp: string; author: string; own?: boolean; read?: boolean; clientId?: string; createdAt?: string; deletedAt?: string | null; senderId?: string; };
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
function mapMessage(row: any): Message {
  const created = row.createdAt ?? row.created_at;
  const sender = row.sender?.displayName ?? row.sender?.display_name ?? row.author ?? "کاربر";
  const deletedAt = row.deletedAt ?? row.deleted_at ?? null;
  return { id: row.id, body: row.body ?? row.content ?? "", timestamp: timeLabel(created), createdAt: created, author: sender, own: currentUserId ? row.senderId === currentUserId || row.sender_id === currentUserId : row.own, read: true, clientId: row.clientId ?? row.client_id, deletedAt, senderId: row.senderId ?? row.sender_id };
}

export function useSessionUser() {
  const [user, setUser] = useState<SessionUser | null>(null); const [loading, setLoading] = useState(true);
  useEffect(() => { request<{ user: SessionUser }>("/api/auth/me").then((value) => { currentUserId = value.user.id; setUser(value.user); if (typeof window !== "undefined") window.dispatchEvent(new Event("shahabgram:user-ready")); }).catch(() => { currentUserId = null; setUser(null); }).finally(() => setLoading(false)); }, []);
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
    const handleUserReady = () => { void sync(); };
    if (typeof window !== "undefined") window.addEventListener("shahabgram:user-ready", handleUserReady);
    let channel: any;
    // Realtime is preferred, while polling keeps conversations live when a
    // deployment has Realtime disabled or a token/subscription is unavailable.
    const pollTimer = setInterval(() => { void sync(); }, 2500);
    const supabase = getSupabaseBrowser();
    if (supabase) {
      request<{ token: string }>("/api/realtime-token").then(async ({ token }) => {
        if (!active) return;
        await supabase.realtime.setAuth(token);
        if (!active) return;
        const handleChange = (payload: any) => {
          const row = payload.new ?? payload.old;
          if (!row?.id) return;
          // A soft delete is emitted as UPDATE. Remove it from every open
          // client immediately instead of waiting for the next poll.
          if (payload.eventType === "DELETE" || row.deleted_at) {
            setData((previous) => previous.filter((item) => item.id !== row.id));
            return;
          }
          // Fetch the joined sender before merging so live messages have the
          // same author/own metadata as messages loaded on initial sync.
          void sync();
        };
        channel = supabase.channel(`messages:${conversationId}`)
          .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` }, handleChange)
          .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` }, handleChange)
          .on("postgres_changes", { event: "DELETE", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` }, handleChange)
          .subscribe((status: string, error?: Error) => { if (status !== "SUBSCRIBED") console.warn("[ShahabGram] realtime status", status, error?.message ?? ""); });
      }).catch((reason) => { if (active) console.warn("[ShahabGram] realtime unavailable", reason instanceof Error ? reason.message : reason); });
    }
    return () => { active = false; clearInterval(pollTimer); if (typeof window !== "undefined") window.removeEventListener("shahabgram:user-ready", handleUserReady); if (channel) void supabase?.removeChannel(channel); };
  }, [conversationId]);
  const send = useCallback(async (body: string) => { if (!body.trim()) return; setSending(true); const clientId = crypto.randomUUID(); const optimistic: Message = { id: `client-${clientId}`, body: body.trim(), timestamp: "اکنون", author: "شما", own: true, read: false, clientId }; setData((previous) => [...previous, optimistic]); try { const value = await request<{ message: any }>(`/api/conversations/${conversationId}/messages`, { method: "POST", body: JSON.stringify({ body: body.trim(), clientId }) }); setData((previous) => previous.map((item) => item.clientId === clientId ? mapMessage(value.message) : item)); } catch { setData((previous) => previous.filter((item) => item.clientId !== clientId)); throw new Error("پیام ارسال نشد"); } finally { setSending(false); } }, [conversationId]);
  const remove = useCallback(async (messageId: string) => {
    let removed: Message | undefined;
    setData((previous) => {
      removed = previous.find((item) => item.id === messageId);
      return previous.filter((item) => item.id !== messageId);
    });
    try {
      await request(`/api/conversations/${conversationId}/messages`, { method: "DELETE", body: JSON.stringify({ messageId }) });
    } catch (reason) {
      if (removed) setData((previous) => [...previous, removed as Message].sort((a, b) => (a.createdAt ?? "").localeCompare(b.createdAt ?? "")));
      throw new Error(reason instanceof Error ? reason.message : "پیام حذف نشد");
    }
  }, [conversationId]);
  return { data, loading, error, sending, send, remove };
}

export function usePreferences() {
  const [data, setData] = useState<UserPreferences>(defaultPreferences); const [loading, setLoading] = useState(true);
  useEffect(() => { try { const saved = localStorage.getItem("shahabgram_preferences"); if (saved) setData({ ...defaultPreferences, ...JSON.parse(saved) }); } catch { /* ignore */ } finally { setLoading(false); } }, []);
  const update = useCallback(async (partial: Partial<UserPreferences>) => { const next = { ...data, ...partial }; setData(next); localStorage.setItem("shahabgram_preferences", JSON.stringify(next)); return next; }, [data]);
  return { data, loading, update };
}

export function useConversation(conversationId: string) { const { data } = useConversations(); return useMemo(() => data.find((item) => item.id === conversationId), [conversationId, data]); }

