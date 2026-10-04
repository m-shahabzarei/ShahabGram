"use client";

import { Suspense, useState } from "react";
import type { FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "../../components/app-shell";
import { GlobalSearchResults } from "../../components/global-search-results";
import { Icon } from "../../components/icon";

function SearchContent({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = query.trim();
    router.replace(value ? `/search?q=${encodeURIComponent(value)}` : "/search");
  }

  return <AppShell title="جست‌وجو" hint="پیدا کردن کاربران، گروه‌ها و کانال‌های عمومی">
    <div className="section-heading"><div><h1>جست‌وجو</h1><p>کاربران، گروه‌ها و کانال‌های عمومی را پیدا کن.</p></div></div>
    <section className="card card--padded" aria-label="جست‌وجوی سراسری">
      <form className="search-form" role="search" onSubmit={submit}>
        <label className="sr-only" htmlFor="global-search">نام، نام کاربری یا شناسهٔ گروه و کانال</label>
        <div className="search-input-wrap"><Icon name="search" size={18} /><input id="global-search" className="input" dir="auto" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="جست‌وجوی کاربران، گروه‌ها و کانال‌ها…" /></div>
        <button className="button button--primary" type="submit"><Icon name="search" size={17} />جست‌وجو</button>
      </form>
      <GlobalSearchResults query={query} />
    </section>
  </AppShell>;
}

function SearchFromUrl() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q") ?? "";
  return <SearchContent key={query} initialQuery={query} />;
}

export default function SearchPage() {
  return <Suspense fallback={<div className="empty-state" role="status">در حال بارگذاری جست‌وجو…</div>}><SearchFromUrl /></Suspense>;
}
