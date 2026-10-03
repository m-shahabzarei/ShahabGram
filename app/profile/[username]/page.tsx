"use client";

import { useEffect, useState } from "react";
import { AppShell } from "../../../components/app-shell";
import { Icon } from "../../../components/icon";

export default function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const [username, setUsername] = useState(""); const [profile, setProfile] = useState<any>(null); const [loading, setLoading] = useState(true);
  useEffect(() => { params.then(({ username: value }) => { setUsername(value); fetch(`/api/users/search?q=${encodeURIComponent(value)}`).then((response) => response.json()).then((body) => setProfile(body.users?.[0] ?? null)).finally(() => setLoading(false)); }); }, [params]);
  return <AppShell title="پروفایل" hint="اطلاعات عمومی کاربر"><div className="settings-section profile-view">{loading ? <div className="empty-state">در حال بارگذاری…</div> : profile ? <><span className="avatar avatar--large">{profile.displayName?.slice(0, 1) ?? "؟"}</span><h1>{profile.displayName}</h1><p className="mono">@{profile.username}</p><p>{profile.bio || "این کاربر هنوز معرفی کوتاهی ننوشته است."}</p><a className="button button--primary" href={`/chat/${profile.id}`}><Icon name="chat" size={17} />شروع گفت‌وگو</a></> : <div className="empty-state"><p>کاربر @{username} پیدا نشد.</p></div>}</div></AppShell>;
}
