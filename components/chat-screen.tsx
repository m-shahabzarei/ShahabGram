"use client";

import Link from "next/link";
import { useState } from "react";
import type { FormEvent } from "react";
import { ConversationList } from "./conversation-list";
import { useConversation, useConversations, useMessages } from "./data-hooks";
import { Icon } from "./icon";

export function ChatScreen({ conversationId }: { conversationId: string }) {
  const conversation = useConversation(conversationId);
  const { data: conversations, loading: conversationsLoading } = useConversations();
  const { data: messages, loading, sending, send, remove } = useMessages(conversationId);
  const [draft, setDraft] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const submit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); if (!draft.trim() || sending) return; await send(draft); setDraft(""); };
  const deleteMessage = async (messageId: string) => { setDeleteError(null); try { await remove(messageId); } catch (error) { setDeleteError(error instanceof Error ? error.message : "حذف پیام انجام نشد"); } };
  const title = conversation?.name ?? "گفت‌وگو";
  return <div className="chat-layout">
    <aside className="chat-list-panel" aria-label="فهرست گفت‌وگوها">
      <div className="chat-list-head"><h2>گفت‌وگوها</h2><Link href="/search" className="icon-button" aria-label="گفت‌وگوی جدید"><Icon name="plus" size={18} /></Link></div>
      <ConversationList items={conversations} compact />
    </aside>
    <section className="chat-window" aria-labelledby="chat-title">
      <header className="chat-window-head">
        <Link href="/" className="icon-button mobile-only" aria-label="بازگشت"><Icon name="arrow-right" size={19} /></Link>
        <span className="avatar" aria-hidden="true">{conversation?.initials ?? "؟"}</span>
        <div className="chat-window-head-main"><h1 id="chat-title">{title}</h1><p>{conversation?.online ? "اکنون آنلاین" : conversation?.handle ?? "گفت‌وگوی خصوصی"}</p></div>
        <Link className="icon-button" aria-label="مدیریت گفت‌وگو" href={`/chat/${conversationId}/settings`}><Icon name="more" size={19} /></Link>
      </header>
      <div className="message-scroll" aria-live="polite">
        {deleteError && <p role="alert" className="field-hint" style={{ color: "var(--danger)", margin: 0 }}>{deleteError}</p>}
        {loading || conversationsLoading ? <div className="empty-state"><span className="mono">LOADING…</span></div> : !conversation ? <div className="empty-state"><p>این گفت‌وگو پیدا نشد.</p><Link className="button button--ghost" href="/">بازگشت به صندوق ورودی</Link></div> : messages.length ? messages.map((message) => <div className="message-row" data-own={Boolean(message.own)} key={message.id}>
          {!message.own && <span className="avatar" aria-hidden="true">{message.author.slice(0, 1)}</span>}
          <article className="message-bubble"><p className="message-text" dir="auto">{message.body}</p><div className="message-meta"><time>{message.timestamp}</time>{message.own && message.read && <Icon name="check" size={13} />}{message.own && !message.deletedAt && !message.id.startsWith("client-") && <button type="button" className="message-delete-button" aria-label="حذف پیام" title="حذف پیام" onClick={() => void deleteMessage(message.id)}><Icon name="close" size={13} /></button>}</div></article>
        </div>) : <div className="empty-state"><p>این گفت‌وگو هنوز پیامی ندارد.</p><span>اولین پیام را بفرست.</span></div>}
      </div>
      {conversation && <form className="chat-composer" onSubmit={submit}>
        <button className="icon-button" type="button" aria-label="پیوست"><Icon name="paperclip" size={19} /></button>
        <textarea className="textarea" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="پیامت را بنویس…" rows={1} aria-label="متن پیام" />
        <button className="button button--primary" type="submit" disabled={!draft.trim() || sending}><Icon name="send" size={18} /><span>{sending ? "…" : "ارسال"}</span></button>
      </form>}
    </section>
  </div>;
}


