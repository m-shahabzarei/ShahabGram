"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import type { User } from "@/types";
import { Icon } from "./icon";

type PublicConversation = {
  id: string;
  title: string;
  type: "group" | "channel";
  slug: string | null;
  description: string | null;
};

type SearchState = {
  query: string;
  status: "loading" | "success" | "error";
  users: User[];
  publicConversations: PublicConversation[];
  error: string;
};

export function GlobalSearchResults({ query, compact = false, onOpened }: { query: string; compact?: boolean; onOpened?: () => void }) {
  const router = useRouter();
  const headingId = useId();
  const normalizedQuery = query.trim();
  const [result, setResult] = useState<SearchState>({ query: normalizedQuery, status: "loading", users: [], publicConversations: [], error: "" });
  const [retry, setRetry] = useState(0);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setResult({ query: normalizedQuery, status: "loading", users: [], publicConversations: [], error: "" });
    setActionError("");
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(normalizedQuery)}`, { cache: "no-store", signal: controller.signal });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "جست‌وجو انجام نشد");
        if (!controller.signal.aborted) setResult({ query: normalizedQuery, status: "success", users: body.users ?? [], publicConversations: body.publicConversations ?? [], error: "" });
      } catch (reason) {
        if (!controller.signal.aborted) setResult({ query: normalizedQuery, status: "error", users: [], publicConversations: [], error: reason instanceof Error ? reason.message : "جست‌وجو انجام نشد" });
      }
    }, normalizedQuery ? 250 : 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [normalizedQuery, retry]);

  async function openConversation(id: string, kind: "user" | "public", person?: User) {
    if (pendingId) return;
    setPendingId(`${kind}:${id}`);
    setActionError("");
    try {
      const response = await fetch(kind === "user" ? "/api/conversations" : `/api/conversations/${id}/join`, {
        method: "POST",
        ...(person ? {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "direct", title: person.displayName, memberIds: [person.id], visibility: "private" }),
        } : {}),
      });
      const body = await response.json();
      if (!response.ok || !body.conversation?.id) throw new Error(body.error ?? "باز کردن گفت‌وگو انجام نشد");
      onOpened?.();
      router.push(`/chat/${body.conversation.id}`);
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "باز کردن گفت‌وگو انجام نشد");
    } finally {
      setPendingId(null);
    }
  }

  const loading = result.query !== normalizedQuery || result.status === "loading";
  return <div className={`global-search-results ${compact ? "global-search-results--compact" : ""}`} aria-busy={loading}>
    {actionError && <p className="global-search-error" role="alert">{actionError}</p>}
    {loading ? <div className="empty-state" role="status">در حال جست‌وجو…</div> : result.status === "error" ? <div className="empty-state"><p className="global-search-error" role="alert">{result.error}</p><button type="button" className="button" onClick={() => setRetry((value) => value + 1)}>تلاش دوباره</button></div> : !result.users.length && !result.publicConversations.length ? <div className="empty-state" role="status"><p>{normalizedQuery ? "نتیجه‌ای پیدا نشد." : "هنوز کاربر یا گفت‌وگوی عمومی دیگری وجود ندارد."}</p></div> : <>
      {result.users.length > 0 && <section aria-labelledby={`${headingId}-users`}><h2 className="global-search-heading" id={`${headingId}-users`}>کاربران</h2><ul className="global-search-list">{result.users.map((person) => <li className="conversation-item global-search-item" key={person.id}>
        <Link href={`/profile/${encodeURIComponent(person.username)}`} className="people-row-link" aria-label={`نمایهٔ ${person.displayName}`}><span className="avatar" aria-hidden="true">{person.displayName.slice(0, 1) || "؟"}</span><span className="conversation-item-main"><strong className="conversation-item-name" dir="auto">{person.displayName}</strong><span className="conversation-item-preview" dir="ltr">@{person.username}</span></span></Link>
        <button className="button global-search-action" type="button" disabled={Boolean(pendingId)} onClick={() => void openConversation(person.id, "user", person)} aria-label={`شروع گفت‌وگو با ${person.displayName}`}>{pendingId === `user:${person.id}` ? "…" : <><Icon name="chat" size={16} /><span>پیام</span></>}</button>
      </li>)}</ul></section>}
      {result.publicConversations.length > 0 && <section aria-labelledby={`${headingId}-public`}><h2 className="global-search-heading" id={`${headingId}-public`}>گروه‌ها و کانال‌های عمومی</h2><ul className="global-search-list">{result.publicConversations.map((conversation) => <li className="conversation-item global-search-item" key={conversation.id}>
        <div className="people-row-link"><span className="avatar" aria-hidden="true"><Icon name={conversation.type === "channel" ? "inbox" : "chat"} size={22} /></span><span className="conversation-item-main"><strong className="conversation-item-name" dir="auto">{conversation.title}</strong><span className="conversation-item-preview" dir="auto">{conversation.type === "channel" ? "کانال عمومی" : "گروه عمومی"}{conversation.slug ? ` · @${conversation.slug}` : ""}</span></span></div>
        <button className="button global-search-action" type="button" disabled={Boolean(pendingId)} onClick={() => void openConversation(conversation.id, "public")} aria-label={`عضویت و باز کردن ${conversation.title}`}>{pendingId === `public:${conversation.id}` ? "…" : "عضویت"}</button>
      </li>)}</ul></section>}
    </>}
  </div>;
}
