"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";
import { Icon } from "../../components/icon";

export default function AuthPage() {
  const router = useRouter();
  const [language, setLanguage] = useState<"fa" | "en">("fa");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const isFa = language === "fa";
  const copy = isFa ? { login: "ورود به حساب", signup: "ساخت حساب", welcome: mode === "login" ? "خوش برگشتی" : "حساب بساز", desc: "برای ادامه وارد فضای شخصی خودت شو.", username: "نام کاربری", displayName: "نام نمایشی", password: "رمز عبور", submit: mode === "login" ? "ورود به حساب" : "ساخت حساب", switch: mode === "login" ? "حساب نداری؟" : "قبلاً ثبت‌نام کردی؟", switchAction: mode === "login" ? "ثبت‌نام کن" : "وارد شو", invalid: "نام کاربری یا رمز عبور معتبر نیست", min: "حداقل ۸ کاراکتر" } : { login: "Sign in", signup: "Create account", welcome: mode === "login" ? "Welcome back" : "Create your account", desc: "Sign in to continue to your private space.", username: "Username", displayName: "Display name", password: "Password", submit: mode === "login" ? "Sign in" : "Create account", switch: mode === "login" ? "No account yet?" : "Already registered?", switchAction: mode === "login" ? "Sign up" : "Sign in", invalid: "Username or password is invalid", min: "At least 8 characters" };
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setLoading(true);
    try { const response = await fetch(`/api/auth/${mode === "login" ? "login" : "register"}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password, ...(mode === "signup" ? { displayName: displayName || username } : {}) }) }); const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error || copy.invalid); const next = new URLSearchParams(window.location.search).get("next"); router.push(next?.startsWith("/") ? next : "/"); router.refresh(); } catch (err) { setError(err instanceof Error ? err.message : copy.invalid); } finally { setLoading(false); }
  }
  return <main className="auth-page" dir={isFa ? "rtl" : "ltr"}>
    <section className="auth-card" aria-labelledby="auth-title">
      <div className="auth-brand"><Link href="/auth" className="brand-lockup"><span className="brand-mark">ش</span><span><strong className="brand-name">ShahabGram</strong><small className="brand-subtitle">quiet conversations</small></span></Link><div className="language-toggle" aria-label={isFa ? "انتخاب زبان" : "Choose language"}><button type="button" data-active={isFa} onClick={() => setLanguage("fa")}>فا</button><button type="button" data-active={!isFa} onClick={() => setLanguage("en")}>EN</button></div></div>
      <h1 className="auth-title" id="auth-title">{copy.welcome}</h1><p className="auth-copy">{copy.desc}</p>
      <form className="auth-form" onSubmit={submit}>
        {mode === "signup" && <div className="field"><label htmlFor="name">{copy.displayName}</label><input id="name" className="input" autoComplete="name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder={isFa ? "مثلاً شهاب" : "e.g. Shahab"} /></div>}
        <div className="field"><label htmlFor="username">{copy.username}</label><input id="username" className="input mono" dir="ltr" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value.toLowerCase())} placeholder="shahab_gram" pattern="[a-z0-9_]{3,32}" required /></div>
        <div className="field"><label htmlFor="password">{copy.password}</label><input id="password" className="input" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" minLength={8} required /><span className="field-hint">{copy.min}</span></div>
        {error && <p className="field-hint" role="alert" style={{ color: "var(--danger)" }}>{error}</p>}
        <button className="button button--primary button--wide" type="submit" disabled={loading}><Icon name="arrow-left" size={17} />{loading ? "…" : copy.submit}</button>
      </form>
      <p className="auth-switch">{copy.switch} <button type="button" className="text-button" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); }}>{copy.switchAction}</button></p>
    </section>
  </main>;
}
