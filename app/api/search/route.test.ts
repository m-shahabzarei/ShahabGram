import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSessionUser, getSupabaseAdmin } = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  getSupabaseAdmin: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getSessionUser }));
vi.mock("@/lib/supabase", () => ({ getSupabaseAdmin }));

import { GET } from "./route";

type Row = Record<string, unknown>;
type Filter = { operation: string; field: string; value: unknown };
type SearchCall = { table: string; fields?: string; filters: Filter[]; search?: string; limit?: number };

function database(tables: Record<string, Row[]>, errorTable?: string) {
  const calls: SearchCall[] = [];
  const from = vi.fn((table: string) => {
    const call: SearchCall = { table, filters: [] };
    calls.push(call);
    const query = {
      select(fields: string) { call.fields = fields; return query; },
      neq(field: string, value: unknown) { call.filters.push({ operation: "neq", field, value }); return query; },
      eq(field: string, value: unknown) { call.filters.push({ operation: "eq", field, value }); return query; },
      is(field: string, value: unknown) { call.filters.push({ operation: "is", field, value }); return query; },
      in(field: string, value: unknown[]) { call.filters.push({ operation: "in", field, value }); return query; },
      order() { return query; },
      limit(value: number) { call.limit = value; return query; },
      or(value: string) { call.search = value; return query; },
      then(resolve: (result: { data: Row[] | null; error: unknown }) => unknown) {
        const rows = (tables[table] ?? []).filter((row) => call.filters.every(({ operation, field, value }) => {
          if (operation === "neq") return row[field] !== value;
          if (operation === "in") return (value as unknown[]).includes(row[field]);
          return row[field] === value;
        })).slice(0, call.limit);
        return Promise.resolve(resolve({ data: errorTable === table ? null : rows, error: errorTable === table ? { message: "Unavailable" } : null }));
      },
    };
    return query;
  });
  return { from, calls };
}

const publicGroup = { id: "group", type: "group", title: "گروه عمومی", slug: "group", visibility: "public", owner_id: "owner", deleted_at: null, created_at: "2026-10-04" };
const publicChannel = { ...publicGroup, id: "channel", type: "channel", title: "کانال عمومی" };

describe("global search API", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getSessionUser.mockResolvedValue({ id: "current-user" });
  });

  it("requires authentication before querying the directory", async () => {
    getSessionUser.mockResolvedValue(null);
    const response = await GET(new Request("http://localhost/api/search?q=test"));
    expect(response.status).toBe(401);
    expect(getSupabaseAdmin).not.toHaveBeenCalled();
  });

  it("returns other users and only public, nondeleted groups and channels", async () => {
    const db = database({
      users: [
        { id: "current-user", username: "self", display_name: "Self" },
        { id: "other-user", username: "ali", display_name: "علی", password_hash: "must-not-leak" },
      ],
      conversations: [
        publicGroup,
        publicChannel,
        { ...publicGroup, id: "private", visibility: "private" },
        { ...publicGroup, id: "direct", type: "direct" },
        { ...publicGroup, id: "deleted", deleted_at: "2026-10-04" },
      ],
    });
    getSupabaseAdmin.mockReturnValue(db);

    const response = await GET(new Request("http://localhost/api/search"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.users.map((user: Row) => user.id)).toEqual(["other-user"]);
    expect(body.users[0]).toMatchObject({ displayName: "علی", username: "ali" });
    expect(body.users[0]).not.toHaveProperty("password_hash");
    expect(body.publicConversations.map((conversation: Row) => conversation.id)).toEqual(["group", "channel"]);
    expect(body.publicConversations[0]).toMatchObject({ title: "گروه عمومی", visibility: "public" });
    expect(db.calls.find((call) => call.table === "users")?.fields).not.toContain("password");
    expect(db.calls.every((call) => call.search === undefined)).toBe(true);
  });

  it("uses the same sanitized query across users and public conversation fields", async () => {
    const db = database({ users: [], conversations: [] });
    getSupabaseAdmin.mockReturnValue(db);
    const value = " @علی,visibility.eq.private)_%*\\ ";

    const response = await GET(new Request(`http://localhost/api/search?q=${encodeURIComponent(value)}`));

    expect(response.status).toBe(200);
    expect(db.calls.find((call) => call.table === "users")?.search).toBe('username.ilike."%علی visibility.eq.private \\\\_%",display_name.ilike."%علی visibility.eq.private \\\\_%"');
    expect(db.calls.find((call) => call.table === "conversations")?.search).toBe('title.ilike."%علی visibility.eq.private \\\\_%",slug.ilike."%علی visibility.eq.private \\\\_%",description.ilike."%علی visibility.eq.private \\\\_%"');
  });

  it("matches underscores literally in username and public slug identifiers after removing the @ prefix", async () => {
    const db = database({ users: [], conversations: [] });
    getSupabaseAdmin.mockReturnValue(db);

    const response = await GET(new Request("http://localhost/api/search?q=%40ali_reza"));

    expect(response.status).toBe(200);
    expect(db.calls.find((call) => call.table === "users")?.search).toBe('username.ilike."%ali\\\\_reza%",display_name.ilike."%ali\\\\_reza%"');
    expect(db.calls.find((call) => call.table === "conversations")?.search).toContain('slug.ilike."%ali\\\\_reza%"');
  });

  it.each(["گروه‌های برنامه‌نویسی", "گروه\u200dهای بَرنامه‌نویسی"])("preserves Persian joiners and combining marks in %s", async (value) => {
    const db = database({ users: [], conversations: [] });
    getSupabaseAdmin.mockReturnValue(db);

    const response = await GET(new Request(`http://localhost/api/search?q=${encodeURIComponent(value)}`));

    expect(response.status).toBe(200);
    expect(db.calls.find((call) => call.table === "conversations")?.search).toBe(`title.ilike."%${value}%",slug.ilike."%${value}%",description.ilike."%${value}%"`);
  });

  it.each(["@%*,()\\", "___", "...--", "\u200c\u200dَ"])("returns no results for an unsafe or punctuation-only query: %s", async (value) => {
    const response = await GET(new Request(`http://localhost/api/search?q=${encodeURIComponent(value)}`));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ users: [], publicConversations: [] });
    expect(getSupabaseAdmin).not.toHaveBeenCalled();
  });

  it.each(["users", "conversations"])("reports a %s query failure instead of incomplete results", async (errorTable) => {
    getSupabaseAdmin.mockReturnValue(database({ users: [], conversations: [] }, errorTable));
    const response = await GET(new Request("http://localhost/api/search?q=test"));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Could not search" });
  });
});
