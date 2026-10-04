# Global Sidebar Search Implementation Plan

> **For agentic workers:** Execute the API and client tasks in parallel, then review their integration and run the repository checks.

**Goal:** Use one global search flow for users and public groups/channels in both the chat sidebar and `/search`.

**Architecture:** `/api/search?q=` returns `{ users, publicConversations }` with authenticated, bounded, sanitized queries. A shared `GlobalSearchResults({ query, compact?, onOpened? })` component fetches results after a 250 ms debounce, cancels superseded requests, and provides direct-chat and public-membership actions. The sidebar renders it during a query; the main search page uses the same component and preserves `q` in its URL.

**Tech Stack:** Next.js App Router, React, TypeScript, Supabase, Vitest, existing custom CSS.

## Global Constraints

- Keep the current chat viewport and internal scrolling behavior.
- Search public, nondeleted groups and channels; keep private conversations out of discovery.
- Public membership actions add only the authenticated user and preserve existing roles.
- Native inputs, buttons, and links have Persian accessible labels and visible focus states.

---

### Task 1: Global discovery and public membership

**Files:** `app/api/search/route.ts`, `app/api/conversations/[id]/join/route.ts`, adjacent `route.test.ts` files.

**Interfaces:** `GET /api/search?q=` returns users and public conversations. `POST /api/conversations/:id/join` returns the joined conversation.

- [x] Verify unauthenticated requests return 401 without querying the database.
- [x] Query users by username/display name and public groups/channels by title/slug/description; sanitize PostgREST filter syntax and limit result sizes.
- [x] Reject joining private/direct/deleted conversations; keep owner/admin roles when reactivating membership and tolerate concurrent joins.
- [x] Test auth, public visibility, malicious filter input, membership role preservation, and repeated joins with mocked Supabase responses.

### Task 2: Shared search UI

**Files:** `components/global-search-results.tsx`, `components/chat-screen.tsx`, `app/search/page.tsx`, `app/globals.css`.

**Interfaces:** `GlobalSearchResults({ query: string, compact?: boolean, onOpened?: () => void })`.

- [x] Fetch `/api/search?q=${encodeURIComponent(query.trim())}` with an `AbortController` and a 250 ms timer; ignore aborted/stale responses and clear old results while a new query loads.
- [x] Render separate user/public sections with loading, error/retry, and no-result states. Start direct chats through the existing `/api/conversations` API; join a public result only through an explicit membership button.
- [x] Render global results inside the sidebar when its input is nonempty. Clear/Escape restores existing chat tabs and the conversation list; Enter preserves the query at `/search?q=`.
- [x] Replace duplicated main-page fetch/action logic with the shared component. Wrap `useSearchParams` in Suspense for static builds.
- [x] Keep compact result rows inside the existing sidebar scroller and retain visible keyboard focus.

### Task 3: Integration validation

- [x] Review both entry points for shared query/results/actions, public visibility, request races, and loading feedback.
- [x] Run `pnpm typecheck`, `pnpm test`, `pnpm build`, and `git diff --check` sequentially as needed.
- [x] Verify typing, clearing, no-results, direct-chat and membership navigation with available local preview/test tooling; document any environment limitation.

## Validation evidence

- `pnpm typecheck`, `pnpm build`, and `git diff --check` passed; `pnpm test` passed all 31 tests, including 28 search/join API regression tests.
- Independent integration review found no remaining introduced defects.
- Browser verification used the real React components with local mocked data/APIs: live sidebar results, empty results, Escape, Enter with an underscore identifier, direct chat, and public group/channel membership navigation passed.
- Live Supabase verification was unavailable because the workspace has no configured backend credentials.
