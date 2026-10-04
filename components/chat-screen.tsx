"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { ConversationList } from "./conversation-list";
import { useConversations, useMessages } from "./data-hooks";
import { GlobalSearchResults } from "./global-search-results";
import { Icon } from "./icon";

export function ChatScreen({ conversationId }: { conversationId: string }) {
  const router = useRouter();
  const { data: conversations, loading: conversationsLoading, reload } = useConversations();
  const conversation = conversations.find((item) => item.id === conversationId);
  const { data: messages, loading, sending, send, remove } = useMessages(conversationId);
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "personal" | "groups" | "channels">("all");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const searching = Boolean(query.trim());
  const visibleConversations = useMemo(() => conversations.filter((item) => activeTab === "all" || (activeTab === "personal" && item.type === "direct") || (activeTab === "groups" && item.type === "group") || (activeTab === "channels" && item.type === "channel")), [activeTab, conversations]);
  const submit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); if (!draft.trim() || sending) return; await send(draft); setDraft(""); };
  const submitSidebarSearch = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const value = query.trim(); router.push(value ? `/search?q=${encodeURIComponent(value)}` : "/search"); };
  const deleteMessage = async (messageId: string) => { setDeleteError(null); try { await remove(messageId); } catch (error) { setDeleteError(error instanceof Error ? error.message : "حذف پیام انجام نشد"); } };
  const title = conversation?.name ?? "گفت‌وگو";
  return <div className="chat-layout">
    <aside className="chat-list-panel" aria-label="فهرست گفت‌وگوها">
      <div className="chat-list-toolbar">
        <button className="icon-button telegram-menu-button" type="button" aria-label="باز کردن منو"><Icon name="menu" size={21} /></button>
        <form className="chat-search-form" role="search" onSubmit={submitSidebarSearch}><div className="chat-search"><button type="submit" className="chat-search-control" aria-label="باز کردن جست‌وجوی اصلی"><Icon name="search" size={18} /></button><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") setQuery(""); }} dir="auto" autoComplete="off" placeholder="Search" aria-label="جست‌وجوی افراد، گروه‌ها و کانال‌ها" />{query && <button type="button" className="chat-search-control" aria-label="پاک کردن جست‌وجو" onClick={() => setQuery("")}><Icon name="close" size={16} /></button>}</div></form>
      </div>
      {!searching && <div className="chat-tabs" role="tablist" aria-label="دسته‌بندی گفت‌وگوها">
        {([['all', 'All'], ['personal', 'Personal'], ['groups', 'Groups'], ['channels', 'Channels']] as const).map(([value, label]) => <button key={value} type="button" role="tab" aria-selected={activeTab === value} data-active={activeTab === value} onClick={() => setActiveTab(value)}>{label}{value === "all" && conversations.length > 0 ? <span>{conversations.length}</span> : null}</button>)}
      </div>}
      <div className="chat-list-scroll">
        {searching ? <GlobalSearchResults query={query} compact onOpened={() => { setQuery(""); void reload(); }} /> : <><Link href="/" className="archived-chat"><span className="archived-avatar"><Icon name="inbox" size={21} /></span><span><strong>Archived Chats</strong><small>گفت‌وگوهای بایگانی‌شده</small></span><Icon name="arrow-left" size={16} /></Link><ConversationList items={visibleConversations} /></>}
      </div>
      <Link href="/search" className="chat-compose-fab" aria-label="گفت‌وگوی جدید"><Icon name="plus" size={25} /></Link>
    </aside>
    <section className="chat-window" aria-labelledby="chat-title">
      <header className="chat-window-head">
        <Link href="/" className="icon-button mobile-only" aria-label="بازگشت"><Icon name="arrow-right" size={19} /></Link>
        <span className="avatar" aria-hidden="true">{conversation?.initials ?? "؟"}</span>
        <div className="chat-window-head-main"><h1 id="chat-title">{title}</h1><p>{conversation?.online ? "اکنون آنلاین" : conversation?.handle ?? "گفت‌وگوی خصوصی"}</p></div>
        <div className="chat-window-actions"><button type="button" className="icon-button" aria-label="تماس صوتی"><Icon name="phone" size={19} /></button><button type="button" className="icon-button" aria-label="جست‌وجو در گفت‌وگو"><Icon name="search" size={19} /></button><Link className="icon-button" aria-label="مدیریت گفت‌وگو" href={`/chat/${conversationId}/settings`}><Icon name="more" size={19} /></Link></div>
      </header>
      <div className="message-scroll" aria-live="polite">
        {deleteError && <p role="alert" className="field-hint" style={{ color: "var(--danger)", margin: 0 }}>{deleteError}</p>}
        {loading || conversationsLoading ? <div className="empty-state"><span className="mono">LOADING…</span></div> : !conversation ? <div className="empty-state"><p>این گفت‌وگو پیدا نشد.</p><Link className="button button--ghost" href="/">بازگشت به صندوق ورودی</Link></div> : messages.length ? <><div className="message-day">Today</div>{messages.map((message) => <div className="message-row" data-own={Boolean(message.own)} key={message.id}>
          {!message.own && <span className="avatar" aria-hidden="true">{message.author.slice(0, 1)}</span>}
          <article className="message-bubble">{!message.own && <strong className="message-author">{message.author}</strong>}<p className="message-text" dir="auto">{message.body}</p><div className="message-meta"><time>{message.timestamp}</time>{message.own && message.read && <Icon name="check" size={13} />}{message.own && !message.deletedAt && !message.id.startsWith("client-") && <button type="button" className="message-delete-button" aria-label="حذف پیام" title="حذف پیام" onClick={() => void deleteMessage(message.id)}><Icon name="close" size={13} /></button>}</div></article>
        </div>)}</> : <div className="empty-state"><p>این گفت‌وگو هنوز پیامی ندارد.</p><span>اولین پیام را بفرست.</span></div>}
      </div>
      {conversation && <form className="chat-composer" onSubmit={submit}>
        <button className="icon-button" type="button" aria-label="پیوست"><Icon name="paperclip" size={19} /></button>
        <textarea className="textarea" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Message" rows={1} aria-label="متن پیام" />
        <button className="icon-button" type="button" aria-label="افزودن ایموجی"><span className="emoji-glyph" aria-hidden="true">☺</span></button>
        <button className="chat-send-button" type="submit" disabled={!draft.trim() || sending} aria-label={sending ? "در حال ارسال" : "ارسال پیام"}><Icon name="send" size={19} /></button>
      </form>}
    </section>
  </div>;
}


