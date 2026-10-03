"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Icon } from "./icon";
import { useSessionUser } from "./data-hooks";

type NavItem = { href: string; label: string; icon: "inbox" | "chat" | "settings" };
const navItems: NavItem[] = [{ href: "/", label: "صندوق ورودی", icon: "inbox" }, { href: "/chat/niloofar", label: "گفت‌وگوها", icon: "chat" }, { href: "/settings", label: "تنظیمات", icon: "settings" }];

export function AppShell({ children, title = "صندوق ورودی", hint = "فضایی آرام برای گفت‌وگو" }: { children: ReactNode; title?: string; hint?: string }) {
  const pathname = usePathname(); const router = useRouter(); const { user } = useSessionUser();
  const isActive = (href: string) => href === "/" ? pathname === "/" : pathname.startsWith(href);
  async function logout() { await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined); router.push("/auth"); router.refresh(); }
  const displayName = user?.displayName ?? "مهمان"; const username = user ? `@${user.username}` : "وارد نشده"; const avatar = displayName.slice(0, 1) || "ش";
  return <div className="page-shell" data-direction="rtl">
    <aside className="side-rail" aria-label="ناوبری اصلی">
      <Link href="/" className="brand-lockup" aria-label="صفحه اصلی شهاب‌گرام"><span className="brand-mark">ش</span><span><strong className="brand-name">ShahabGram</strong><small className="brand-subtitle">quiet conversations</small></span></Link>
      <nav className="side-nav">{navItems.map((item) => <Link key={item.href} href={item.href} className="nav-link" aria-current={isActive(item.href) ? "page" : undefined}><Icon name={item.icon} size={20} /><span>{item.label}</span></Link>)}</nav>
      <div className="rail-footer"><button type="button" className="nav-link" onClick={logout}><Icon name="logout" size={20} /><span>خروج</span></button><div className="profile-chip"><span className="avatar">{avatar}</span><p>{displayName}<small>{username}</small></p></div></div>
    </aside>
    <div className="main-column"><header className="topbar"><div><h1 className="topbar-title">{title}</h1><span className="topbar-hint">{hint}</span></div><div className="topbar-actions"><button className="icon-button" aria-label="جست‌وجو"><Icon name="search" size={19} /></button><button className="icon-button" aria-label="اعلان‌ها"><Icon name="bell" size={19} /></button><Link className="button button--primary" href="/chat/niloofar"><Icon name="plus" size={17} /><span>گفت‌وگوی جدید</span></Link></div></header><main className="content-area">{children}</main></div>
    <nav className="mobile-nav" aria-label="ناوبری موبایل">{navItems.map((item) => <Link key={item.href} href={item.href} aria-current={isActive(item.href) ? "page" : undefined}><Icon name={item.icon} size={20} /><span>{item.label}</span></Link>)}</nav>
  </div>;
}
