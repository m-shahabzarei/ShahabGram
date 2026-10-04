import { beforeEach, describe, expect, it, vi } from "vitest";
import { conversationDatabase } from "@/test/conversation-database";

const { getSessionUser, getSupabaseAdmin } = vi.hoisted(() => ({ getSessionUser: vi.fn(), getSupabaseAdmin: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getSessionUser }));
vi.mock("@/lib/supabase", () => ({ getSupabaseAdmin }));
import { POST } from "./route";

const oldId = "10000000-0000-4000-8000-000000000001";
const nextId = "10000000-0000-4000-8000-000000000002";
const newerId = "10000000-0000-4000-8000-000000000003";
const params = { params: Promise.resolve({ id: "chat" }) };
const request = (messageId: unknown = nextId) => new Request("http://localhost/api/conversations/chat/read", { method: "POST", body: JSON.stringify({ messageId }) });
function fixture(marker: string | null = oldId) {
  return {
    conversation_members: [{ conversation_id: "chat", user_id: "me", left_at: null as string | null, last_read_message_id: marker }],
    messages: [oldId, nextId, newerId].map((id, index) => ({ id, conversation_id: "chat", created_at: `2026-10-04T08:0${index}:00Z`, deleted_at: null })),
  };
}

describe("read markers", () => {
  beforeEach(() => { vi.resetAllMocks(); getSessionUser.mockResolvedValue({ id: "me" }); });

  it("requires authentication", async () => {
    getSessionUser.mockResolvedValue(null);
    expect((await POST(request(), params)).status).toBe(401);
    expect(getSupabaseAdmin).not.toHaveBeenCalled();
  });

  it.each(["", "not-a-message-id", null])("rejects invalid marker %s", async (value) => {
    expect((await POST(request(value), params)).status).toBe(422);
    expect(getSupabaseAdmin).not.toHaveBeenCalled();
  });

  it.each(["missing", "left"])("requires an active membership: %s", async (state) => {
    const tables = fixture();
    if (state === "missing") tables.conversation_members = [];
    else tables.conversation_members[0].left_at = "2026-10-04T07:00:00Z";
    const db = conversationDatabase(tables);
    getSupabaseAdmin.mockReturnValue(db);
    expect((await POST(request(), params)).status).toBe(403);
    expect(db.updates).toHaveLength(0);
  });

  it("rejects a marker in a different conversation", async () => {
    const tables = fixture();
    tables.messages[1].conversation_id = "foreign";
    const db = conversationDatabase(tables);
    getSupabaseAdmin.mockReturnValue(db);
    expect((await POST(request(), params)).status).toBe(404);
    expect(db.updates).toHaveLength(0);
  });

  it("advances only the authenticated member's read marker", async () => {
    const tables = fixture();
    tables.conversation_members.push({ ...tables.conversation_members[0], user_id: "other" });
    getSupabaseAdmin.mockReturnValue(conversationDatabase(tables));
    expect((await POST(request(), params)).status).toBe(200);
    expect(tables.conversation_members.map((row) => row.last_read_message_id)).toEqual([nextId, oldId]);
  });

  it("sets the first read marker", async () => {
    const tables = fixture(null);
    getSupabaseAdmin.mockReturnValue(conversationDatabase(tables));
    expect((await POST(request(), params)).status).toBe(200);
    expect(tables.conversation_members[0].last_read_message_id).toBe(nextId);
  });

  it.each([nextId, newerId])("does not regress or rewrite an equal/newer marker: %s", async (marker) => {
    const db = conversationDatabase(fixture(marker));
    getSupabaseAdmin.mockReturnValue(db);
    expect((await POST(request(), params)).status).toBe(200);
    expect(db.tables.conversation_members[0].last_read_message_id).toBe(marker);
    expect(db.updates).toHaveLength(0);
  });

  it("preserves a newer marker saved by a concurrent request", async () => {
    const tables = fixture();
    const db = conversationDatabase(tables, { beforeUpdate: (current) => { current.conversation_members[0].last_read_message_id = newerId; } });
    getSupabaseAdmin.mockReturnValue(db);
    expect((await POST(request(), params)).status).toBe(200);
    expect(tables.conversation_members[0].last_read_message_id).toBe(newerId);
  });

  it.each([
    ["000001", "000002", nextId],
    ["000002", "000001", oldId],
  ])("uses database precision when reads occur within one millisecond (%s, %s)", async (previousFraction, targetFraction, expected) => {
    const tables = fixture();
    tables.messages[0].created_at = `2026-10-04T08:00:00.${previousFraction}+00:00`;
    tables.messages[1].created_at = `2026-10-04T08:00:00.${targetFraction}+00:00`;
    getSupabaseAdmin.mockReturnValue(conversationDatabase(tables));
    expect((await POST(request(), params)).status).toBe(200);
    expect(tables.conversation_members[0].last_read_message_id).toBe(expected);
  });

  it("reports a database failure without saving a marker", async () => {
    const db = conversationDatabase(fixture(), { errorTable: "messages" });
    getSupabaseAdmin.mockReturnValue(db);
    expect((await POST(request(), params)).status).toBe(500);
    expect(db.updates).toHaveLength(0);
  });
});
