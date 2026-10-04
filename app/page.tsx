"use client";

import Link from "next/link";
import { AppShell } from "../components/app-shell";
import { ChatScreen } from "../components/chat-screen";
import { ConversationList } from "../components/conversation-list";
import { Icon } from "../components/icon";
import { useConversations, useSessionUser } from "../components/data-hooks";

export default function HomePage() {
  const { data: conversations, loading } = useConversations();
  const { user } = useSessionUser();
  const unreadCount = conversations.reduce((total, item) => total + (item.unread ?? 0), 0);
  const onlineCount = conversations.filter((item) => item.online).length;
  if (!loading && conversations[0]) return <AppShell mode="telegram" title="گفت‌وگو" hint="پیام‌رسانی ساده و متمرکز"><ChatScreen conversationId={conversations[0].id} /></AppShell>;
  return <AppShell>
    <div className="section-heading">
      <div><span className="eyebrow mono">INBOX</span><h1>سلام {user?.displayName ?? ""}،</h1><p>اینجا می‌توانی گفت‌وگوهای خودت را با تمرکز دنبال کنی.</p></div>
      <Link href="/groups/new" className="button button--primary"><Icon name="plus" size={17} />گروه جدید</Link>
    </div>
    <div className="dashboard-grid">
      <section className="card" aria-labelledby="recent-heading">
        <div className="card-header"><div><h2 id="recent-heading">گفت‌وگوهای اخیر</h2><p>آخرین پیام‌ها و فعالیت‌ها</p></div></div>
        {loading ? <div className="empty-state"><span className="mono">LOADING…</span></div> : <ConversationList items={conversations} />}
      </section>
      <div className="stack">
        <section className="card card--padded" aria-labelledby="overview-heading">
          <div className="section-heading"><div><span className="eyebrow">overview</span><h2 id="overview-heading">نمای کلی امروز</h2></div><Icon name="info" size={18} /></div>
          <div className="stat-grid"><div className="stat"><span className="stat-label">پیام‌های جدید</span><strong className="stat-value">{unreadCount}</strong></div><div className="stat"><span className="stat-label">گفت‌وگوها</span><strong className="stat-value">{conversations.length}</strong></div><div className="stat"><span className="stat-label">آنلاین</span><strong className="stat-value">{onlineCount}</strong></div></div>
        </section>
        <section className="card card--padded" aria-labelledby="quick-heading">
          <div className="section-heading"><div><span className="eyebrow">shortcuts</span><h2 id="quick-heading">دسترسی سریع</h2></div></div>
          <div className="quick-actions"><Link href="/search" className="button"><Icon name="search" size={18} />پیدا کردن افراد و پیام مستقیم</Link><Link href="/groups/new" className="button"><Icon name="chat" size={18} />ساخت گروه</Link><Link href="/channels/new" className="button"><Icon name="plus" size={18} />ساخت کانال</Link><Link href="/settings" className="button"><Icon name="settings" size={18} />تنظیمات حساب</Link></div>
        </section>
      </div>
    </div>
  </AppShell>;
}

