"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Conversation } from "./data-hooks";

export function ConversationList({ items, compact = false }: { items: Conversation[]; compact?: boolean }) {
  const pathname = usePathname();
  if (!items.length) return <div className="empty-state"><p>هنوز گفت‌وگویی ندارید.</p><span>یک گفت‌وگوی تازه شروع کنید.</span></div>;
  return <div className="conversation-list">
    {items.map((item) => {
      const active = pathname === `/chat/${item.id}`;
      return <Link href={`/chat/${item.id}`} className="conversation-item" data-active={active} key={item.id}>
        <span className="avatar" aria-hidden="true">{item.initials}</span>
        <span className="conversation-item-main">
          <span className="conversation-item-row"><strong className="conversation-item-name">{item.name}</strong><time className="conversation-item-time">{item.time}</time></span>
          {!compact && <span className="conversation-item-row"><span className="conversation-item-preview">{item.preview}</span>{item.unread ? <span className="badge" aria-label={`${item.unread} پیام خوانده نشده`}>{item.unread}</span> : item.online ? <span className="unread-dot" aria-label="آنلاین" /> : null}</span>}
        </span>
      </Link>;
    })}
  </div>;
}
