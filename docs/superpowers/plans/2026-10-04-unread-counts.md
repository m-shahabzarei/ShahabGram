# Unread Counts Implementation Plan

> **For agentic workers:** Implement and review these tasks in this session; validate the API and the actual client hooks before committing.

**Goal:** Conversation badges count only unread incoming messages and clear after the conversation is read.

**Architecture:** Keep the existing per-member `last_read_message_id`. Save the latest displayed server message when a chat is visible and focused, validate and advance that marker on the server, and refresh conversation counts after a successful read. Exclude soft-deleted messages from counts and refresh the inbox quietly while visible.

**Tech Stack:** Next.js App Router, React, TypeScript, Supabase, Vitest.

## Global Constraints

- Own messages and deleted messages never increase unread counts.
- A read marker belongs to the selected conversation and authenticated active member.
- Older or concurrent requests cannot move a read marker backward.
- Loading messages in a hidden or unfocused tab must not mark them read.
- Keep the existing chat layout and scrolling behavior.

### Task 1: Server counting and read markers

**Files:** `app/api/conversations/route.ts`, `app/api/conversations/route.test.ts`, `app/api/conversations/[id]/read/route.ts`, `app/api/conversations/[id]/read/route.test.ts`.

**Interfaces:** `POST /api/conversations/:id/read` accepts `{ messageId }`; `GET /api/conversations` returns `unreadCount`.

- [x] Add regression cases with messages before/after a marker, own messages, and deleted messages; assert the returned count.
- [x] Add read-route regressions for authenticated membership, cross-conversation markers, idempotency, advancing markers, and concurrent older requests.
- [x] Run these tests and confirm they expose current failures.
- [x] Count with `.neq("sender_id", user.id).is("deleted_at", null)` and scope marker lookup to the conversation.
- [x] Validate the target message and active membership; compare target/current `created_at`, then update conditionally on the observed `last_read_message_id`. Re-read and retry a conflicting update instead of overwriting a newer marker.
- [x] Run targeted API tests.

### Task 2: Read visible chats and keep badges current

**Files:** `components/data-hooks.ts`, `components/chat-screen.tsx`, `app/chat/[id]/page.tsx`.

**Interfaces:** `useConversationRead(conversationId, latestMessageId, enabled)` saves confirmed displayed messages and emits `shahabgram:conversation-read` on success. `useConversations()` consumes that event and visible-page polling with quiet refreshes.

- [x] Implement the read hook with visibility/focus guards, cancellation, one pending request per selected marker, and retry after failures.
- [x] Call it with the last confirmed message after messages/conversation are loaded. Key the chat screen by conversation ID to isolate navigation state.
- [x] Refresh counts after a successful read and while the inbox is visible; ignore superseded list responses and preserve existing content during quiet refreshes.
- [x] Exercise actual client hooks with mocked APIs: open clears a badge, newly received messages are read in the active chat, hidden/unfocused messages stay unread, focus resumes read updates, and switching chats cannot send the previous chat's marker.

### Task 3: Final validation and delivery

- [x] Run `pnpm test`, `pnpm typecheck`, `pnpm build`, and `git diff --check`.
- [x] Review the diff, record validation limits, commit, and push the authorized change.

## Validation evidence

- The initial regression run reproduced 14 failures in the existing count/read routes. All 21 new tests passed after the fix; the full suite passed all 52 tests. Timestamp comparisons stay in PostgreSQL to preserve sub-millisecond precision.
- `pnpm typecheck`, `pnpm build`, and `git diff --check` passed.
- Playwright exercised the actual `ChatScreen` and data hooks with local mocked HTTP APIs. Nine browser scenarios passed, covering read clearing, active/closed incoming messages, simulated visibility/focus, failed-read retry, switching chats, and reopening.
- Backend queries use mocked Supabase rows in Vitest. Live Supabase verification remains unavailable in this workspace without configured credentials.
