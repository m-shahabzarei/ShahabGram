# ShahabGram Chat Improvements Implementation Plan

> **For agentic workers:** Use the task list below as the implementation checklist.

**Goal:** Make live messaging reliable, make search open and return registered users, let users delete their own messages, and let users start direct chats with registered users.

**Architecture:** Keep the existing Next.js App Router and custom session auth. Add focused API operations for message deletion and user/direct-chat discovery, update the client hooks for Supabase realtime plus polling fallback, and expose search/direct-chat entry points from the shell and home UI.

**Tech Stack:** Next.js 15, React 19, TypeScript, Supabase Postgres/Realtime, Vitest.

## Global Constraints

- Preserve the existing Persian RTL monochrome UI and custom session authentication.
- Never expose the Supabase service role key in browser code.
- User-owned message deletion must be authorized server-side and represented as a tombstone.
- Direct conversations must be unique per pair through the existing `direct_key`.

### Task 1: Realtime and message deletion

**Files:**
- Modify: `components/data-hooks.ts`
- Modify: `components/chat-screen.tsx`
- Modify: `app/api/conversations/[id]/messages/route.ts`
- Modify: `supabase/migrations/001_init.sql` only if realtime publication/policy needs correction

**Steps:**
- Subscribe to INSERT, UPDATE, and DELETE changes for the current conversation.
- Keep a short polling fallback active when Supabase credentials or subscription are unavailable.
- Add DELETE API behavior that only allows the current sender and sets `deleted_at` so the row remains a realtime tombstone.
- Add a client delete action for own messages and render deleted messages as a tombstone.
- Reconcile realtime updates/deletes with optimistic state without duplicates.

### Task 2: Search entry point and user discovery

**Files:**
- Modify: `components/app-shell.tsx`
- Create or modify: `components/user-search.tsx`
- Create or modify: `app/search/page.tsx`
- Modify: `app/globals.css`

**Steps:**
- Make the topbar search button navigate to a working search surface.
- Debounce or submit the query to the existing `/api/users/search` endpoint.
- Render registered users with profile links and a “start direct chat” action.
- Create a direct conversation through `POST /api/conversations` and navigate to its chat route.

### Task 3: Direct-chat backend and correctness

**Files:**
- Modify: `app/api/conversations/route.ts`
- Modify: `app/api/users/search/route.ts`
- Add tests where practical

**Steps:**
- Validate that a direct-chat target exists and is not the current user.
- Return the other user’s display name for direct conversation titles where available.
- Escape search input for PostgREST filter syntax and preserve case-insensitive username/display-name matching.
- Return stable, mapped user data for the search UI.

### Task 4: Verification

- Run `pnpm typecheck`.
- Run `pnpm test`.
- Run `pnpm build`.
- Manually verify search navigation, user result rendering, direct chat creation, send/receive realtime behavior, fallback polling, and deleting only own messages.

