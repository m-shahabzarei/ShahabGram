"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "../../../components/app-shell";
import { Icon } from "../../../components/icon";

export default function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const router = useRouter();
  const [username, setUsername] = useState(""); const [profile, setProfile] = useState<any>(null); const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false); const [error, setError] = useState("");
  useEffect(() => { params.then(({ username: value }) => { setUsername(value); fetch(`/api/users/search?q=${encodeURIComponent(value)}`).then((response) => response.json()).then((body) => setProfile(body.users?.[0] ?? null)).finally(() => setLoading(false)); }); }, [params]);
  async function startDirectChat() {
    if (!profile) return;
    setStarting(true); setError("");
    try {
      const response = await fetch("/api/conversations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "direct", title: profile.displayName, memberIds: [profile.id], visibility: "private" }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.conversation?.id) throw new Error(body.error ?? "شروع گفت‌وگو انجام نشد");
      router.push(`/chat/${body.conversation.id}`);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "شروع گفت‌وگو انجام نشد"); } finally { setStarting(false); }
  }
  return <AppShell title="پروفایل" hint="اطلاعات عمومی کاربر"><div className="settings-section profile-view">{loading ? <div className="empty-state">در حال بارگذاری…</div> : profile ? <><span className="avatar avatar--large">{profile.displayName?.slice(0, 1) ?? "؟"}</span><h1>{profile.displayName}</h1><p className="mono">@{profile.username}</p><p>{profile.bio || "این کاربر هنوز معرفی کوتاهی ننوشته است."}</p>{error && <p className="field-hint" role="alert" style={{ color: "var(--danger)" }}>{error}</p>}<button className="button button--primary" type="button" onClick={startDirectChat} disabled={starting}><Icon name="chat" size={17} />{starting ? "در حال آماده‌سازی…" : "شروع گفت‌وگو"}</button></> : <div className="empty-state"><p>کاربر @{username} پیدا نشد.</p></div>}</div></AppShell>;
}
