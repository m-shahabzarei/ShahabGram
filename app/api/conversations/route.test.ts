import { beforeEach, describe, expect, it, vi } from "vitest";
import { conversationDatabase } from "@/test/conversation-database";

const { getSessionUser, getSupabaseAdmin } = vi.hoisted(() => ({ getSessionUser: vi.fn(), getSupabaseAdmin: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getSessionUser }));
vi.mock("@/lib/supabase", () => ({ getSupabaseAdmin }));
import { GET } from "./route";

const conversation = { id: "chat", type: "group", title: "گروه", visibility: "private", owner_id: "owner", created_at: "2026-10-04T08:00:00Z" };
const message = (id: string, minute: number, sender = "other", deleted_at: string | null = null) => ({ id, conversation_id: "chat", sender_id: sender, body: id, created_at: `2026-10-04T08:${String(minute).padStart(2, "0")}:00Z`, deleted_at });
function fixture(marker: string | null = "read") {
  return {
    conversation_members: [{ conversation_id: "chat", user_id: "me", left_at: null, last_read_message_id: marker, conversations: conversation }],
    messages: [message("old", 1), message("read", 2), message("new", 3), message("own", 4, "me"), message("deleted", 5, "other", "2026-10-04T09:00:00Z")],
  };
}

describe("conversation unread counts", () => {
  beforeEach(() => { vi.resetAllMocks(); getSessionUser.mockResolvedValue({ id: "me" }); });

  it("counts only live incoming messages after the read marker", async () => {
    getSupabaseAdmin.mockReturnValue(conversationDatabase(fixture()));
    const response = await GET();
    expect(response.status).toBe(200);
    expect((await response.json()).conversations[0].unreadCount).toBe(1);
  });

  it("counts never-read incoming messages but excludes own and deleted messages", async () => {
    getSupabaseAdmin.mockReturnValue(conversationDatabase(fixture(null)));
    expect((await (await GET()).json()).conversations[0].unreadCount).toBe(3);
  });

  it("clears the count after reading the latest displayed message", async () => {
    getSupabaseAdmin.mockReturnValue(conversationDatabase(fixture("own")));
    expect((await (await GET()).json()).conversations[0].unreadCount).toBe(0);
  });

  it("still uses a marker that was subsequently soft-deleted", async () => {
    const tables = fixture("read");
    tables.messages[1].deleted_at = "2026-10-04T09:00:00Z";
    getSupabaseAdmin.mockReturnValue(conversationDatabase(tables));
    expect((await (await GET()).json()).conversations[0].unreadCount).toBe(1);
  });

  it("does not apply a marker from another conversation", async () => {
    const tables = fixture("foreign");
    tables.messages.push({ ...message("foreign", 20), conversation_id: "different-chat" });
    getSupabaseAdmin.mockReturnValue(conversationDatabase(tables));
    expect((await (await GET()).json()).conversations[0].unreadCount).toBe(3);
  });

  it("does not report a successful zero count when the messages query fails", async () => {
    getSupabaseAdmin.mockReturnValue(conversationDatabase(fixture(), { errorTable: "messages" }));
    expect((await GET()).status).toBeGreaterThanOrEqual(500);
  });
});
