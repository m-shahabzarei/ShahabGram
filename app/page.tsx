"use client";

import Link from "next/link";
import { AppShell } from "../components/app-shell";
import { ConversationList } from "../components/conversation-list";
import { Icon } from "../components/icon";
import { useConversations } from "../components/data-hooks";

export default function HomePage() {
  const { data: conversations, loading } = useConversations();
  return <AppShell>
    <div className="section-heading">
      <div><span className="eyebrow mono">03 OCT / 2026</span><h1>سلام شهاب،</h1><p>اینجا می‌توانی گفت‌وگوهای خودت را با تمرکز دنبال کنی.</p></div>
      <Link href="/chat/niloofar" className="button button--primary"><Icon name="plus" size={17} />گفت‌وگوی جدید</Link>
    </div>
    <div className="dashboard-grid">
      <section className="card" aria-labelledby="recent-heading">
        <div className="card-header"><div><h2 id="recent-heading">گفت‌وگوهای اخیر</h2><p>آخرین پیام‌ها و فعالیت‌ها</p></div><Link href="/chat/niloofar" className="button button--ghost">مشاهده همه <Icon name="arrow-left" size={16} /></Link></div>
        {loading ? <div className="empty-state"><span className="mono">LOADING…</span></div> : <ConversationList items={conversations} />}
      </section>
      <div className="stack">
        <section className="card card--padded" aria-labelledby="overview-heading">
          <div className="section-heading"><div><span className="eyebrow">overview</span><h2 id="overview-heading">نمای کلی امروز</h2></div><Icon name="info" size={18} /></div>
          <div className="stat-grid"><div className="stat"><span className="stat-label">پیام‌های جدید</span><strong className="stat-value">۰۹</strong></div><div className="stat"><span className="stat-label">گفت‌وگوها</span><strong className="stat-value">۱۲</strong></div><div className="stat"><span className="stat-label">آنلاین</span><strong className="stat-value">۰۳</strong></div></div>
        </section>
        <section className="card card--padded" aria-labelledby="quick-heading">
          <div className="section-heading"><div><span className="eyebrow">shortcuts</span><h2 id="quick-heading">دسترسی سریع</h2></div></div>
          <div className="quick-actions"><Link href="/groups/new" className="button"><Icon name="chat" size={18} />ساخت گروه</Link><Link href="/channels/new" className="button"><Icon name="plus" size={18} />ساخت کانال</Link><Link href="/settings" className="button"><Icon name="settings" size={18} />تنظیمات حساب</Link></div>
        </section>
      </div>
    </div>
  </AppShell>;
}

