"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { AppShell } from "../../components/app-shell";
import { Icon } from "../../components/icon";

type User = {
  id: string;
  username: string;
  displayName: string;
  bio: string | null;
  lastSeenAt: string | null;
};

export default function SearchPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [startingId, setStartingId] = useState<string | null>(null);

  const loadUsers = useCallback(async (value: string) => {
    setLoading(true);
    setError("");
    try {
      const trimmed = value.trim();
      const url = trimmed ? `/api/users?q=${encodeURIComponent(trimmed)}` : "/api/users";
      const response = await fetch(url, { cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "بارگذاری کاربران انجام نشد");
      setUsers(body.users ?? []);
    } catch (reason) {
      setUsers([]);
      setError(reason instanceof Error ? reason.message : "بارگذاری کاربران انجام نشد");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadUsers(""); }, [loadUsers]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    await loadUsers(query);
  }

  async function startDirectChat(person: User) {
    setStartingId(person.id);
    setError("");
    try {
      const response = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "direct", title: person.displayName, memberIds: [person.id], visibility: "private" }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.conversation?.id) throw new Error(body.error ?? "شروع گفت‌وگو انجام نشد");
      router.push(`/chat/${body.conversation.id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "شروع گفت‌وگو انجام نشد");
    } finally {
      setStartingId(null);
    }
  }

  return <AppShell title="جست‌وجو" hint="پیدا کردن افراد و شروع گفت‌وگوی مستقیم">
    <div className="section-heading">
      <div><span className="eyebrow mono">PEOPLE</span><h1>افراد شهاب‌گرام</h1><p>افراد ثبت‌نام‌شده را پیدا کن و برایشان پیام بفرست.</p></div>
    </div>
    <section className="card card--padded" aria-labelledby="people-search-heading">
      <h2 id="people-search-heading" className="sr-only">جست‌وجوی افراد</h2>
      <form className="search-form" onSubmit={submit} role="search">
        <label className="sr-only" htmlFor="people-search">نام کاربری یا نام نمایشی</label>
        <div className="search-input-wrap"><Icon name="search" size={18} /><input id="people-search" className="input" dir="auto" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="نام کاربری یا نام نمایشی…" /></div>
        <button className="button button--primary" type="submit" disabled={loading}><Icon name="search" size={17} />جست‌وجو</button>
      </form>
      {error && <p className="field-hint" role="alert" style={{ color: "var(--danger)", marginTop: 14 }}>{error}</p>}
      {loading ? <div className="empty-state" role="status">در حال بارگذاری افراد…</div> : users.length === 0 ? <div className="empty-state"><p>{query.trim() ? "فردی با این مشخصات پیدا نشد." : "هنوز کاربر دیگری ثبت‌نام نکرده است."}</p></div> : <div className="conversation-list people-list">{users.map((person) => <div className="conversation-item" key={person.id}><Link href={`/profile/${encodeURIComponent(person.username)}`} className="people-row-link"><span className="avatar" aria-hidden="true">{person.displayName.slice(0, 1) || "؟"}</span><span className="conversation-item-main"><span className="conversation-item-row"><strong className="conversation-item-name">{person.displayName}</strong><span className="conversation-item-time">@{person.username}</span></span><span className="conversation-item-preview">{person.bio || "برای شروع گفت‌وگو آماده است"}</span></span></Link><button className="button" type="button" disabled={startingId === person.id} onClick={() => startDirectChat(person)}>{startingId === person.id ? "…" : <><Icon name="chat" size={16} />پیام</>}</button></div>)}</div>}
    </section>
  </AppShell>;
}
