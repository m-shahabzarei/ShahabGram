# ShahabGram

شهاب‌گرام یک پیام‌رسان وب دو زبانه با رابط monochrome، چت خصوصی، گروه، کانال و پیام‌رسانی realtime است.

## توسعه محلی

```bash
pnpm install
Copy-Item .env.example .env.local
pnpm dev
```

در Supabase، فایل `supabase/migrations/001_init.sql` را اجرا کنید. برای APIهای server-side مقدار `SUPABASE_SERVICE_ROLE_KEY` لازم است؛ این کلید هرگز نباید در مرورگر قرار بگیرد.

## متغیرهای محیطی

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_JWT_SECRET`
- `SESSION_PEPPER`
- `NEXT_PUBLIC_APP_URL`

## بررسی کیفیت

```bash
pnpm typecheck
pnpm test
pnpm build
```

برای deploy، ریپو را به Vercel متصل کنید، متغیرهای بالا را در محیط Production و Preview قرار دهید و پس از اجرای migration، redeploy کنید.
