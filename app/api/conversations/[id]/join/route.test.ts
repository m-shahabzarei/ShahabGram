import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSessionUser, getSupabaseAdmin } = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  getSupabaseAdmin: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getSessionUser }));
vi.mock("@/lib/supabase", () => ({ getSupabaseAdmin }));

import { POST } from "./route";

type Row = Record<string, unknown>;
type Membership = { conversation_id: string; user_id: string; role: string; left_at: string | null; joined_at: string };
type Write = { operation: string; values: Row; options?: Row };

const publicGroup = { id: "group", type: "group", title: "گروه عمومی", slug: "group", visibility: "public", owner_id: "owner", deleted_at: null, created_at: "2026-10-04" };

function database(conversation: Row | null, initialMember: Membership | null = null, options: { membershipBarrier?: boolean; concurrentMember?: Membership; writeError?: boolean } = {}) {
  const members = initialMember ? [structuredClone(initialMember)] : [];
  const writes: Write[] = [];
  let readCount = 0;
  let releaseReads: (() => void) | undefined;
  const barrier = options.membershipBarrier ? new Promise<void>((resolve) => { releaseReads = resolve; }) : undefined;
  const from = vi.fn((table: string) => {
    const filters: { field: string; value: unknown }[] = [];
    let write: Write | undefined;
    const matches = (row: Row) => filters.every(({ field, value }) => row[field] === value);
    const query = {
      select() { return query; },
      eq(field: string, value: unknown) { filters.push({ field, value }); return query; },
      is(field: string, value: unknown) { filters.push({ field, value }); return query; },
      update(values: Row) { write = { operation: "update", values }; writes.push(write); return query; },
      upsert(values: Row, insertOptions?: Row) { write = { operation: "upsert", values, options: insertOptions }; writes.push(write); return query; },
      insert(values: Row) { write = { operation: "insert", values }; writes.push(write); return query; },
      async maybeSingle() {
        if (table === "conversations") return { data: conversation && matches(conversation) ? conversation : null, error: null };
        const member = members.find(matches);
        const snapshot = member ? { role: member.role, left_at: member.left_at } : null;
        if (barrier) {
          readCount += 1;
          if (readCount === 2) releaseReads?.();
          await barrier;
        }
        return { data: snapshot, error: null };
      },
      then(resolve: (result: { error: unknown }) => unknown) {
        let error: unknown = options.writeError ? { code: "database-failure" } : null;
        if (!error && write) {
          if (write.operation === "update") {
            for (const member of members.filter(matches)) Object.assign(member, write.values);
          } else {
            if (options.concurrentMember && !members.length) members.push(structuredClone(options.concurrentMember));
            const duplicate = members.find((member) => member.conversation_id === write?.values.conversation_id && member.user_id === write.values.user_id);
            if (duplicate && !write.options?.ignoreDuplicates) error = { code: "23505" };
            if (!duplicate) members.push({ ...write.values, left_at: null, joined_at: "new-join" } as Membership);
          }
        }
        return Promise.resolve(resolve({ error }));
      },
    };
    return query;
  });
  return { from, members, writes };
}

function join() {
  return POST(new Request("http://localhost/api/conversations/group/join", { method: "POST" }), { params: Promise.resolve({ id: "group" }) });
}

function member(role: string, left_at: string | null = null): Membership {
  return { conversation_id: "group", user_id: "current-user", role, left_at, joined_at: "original-join" };
}

describe("join public conversation API", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getSessionUser.mockResolvedValue({ id: "current-user" });
  });

  it("requires authentication before looking up a conversation", async () => {
    getSessionUser.mockResolvedValue(null);
    const response = await join();
    expect(response.status).toBe(401);
    expect(getSupabaseAdmin).not.toHaveBeenCalled();
  });

  it.each([
    ["private group", { ...publicGroup, visibility: "private" }, 403],
    ["direct conversation", { ...publicGroup, type: "direct" }, 403],
    ["deleted group", { ...publicGroup, deleted_at: "2026-10-04" }, 404],
    ["missing conversation", null, 404],
  ] as const)("rejects a %s without adding a membership", async (_name, conversation, expectedStatus) => {
    const db = database(conversation);
    getSupabaseAdmin.mockReturnValue(db);
    const response = await join();
    expect(response.status).toBe(expectedStatus);
    expect(db.writes).toEqual([]);
    expect(db.members).toEqual([]);
  });

  it.each(["group", "channel"])("adds the authenticated user to a public %s as a member", async (type) => {
    const db = database({ ...publicGroup, type });
    getSupabaseAdmin.mockReturnValue(db);
    const response = await join();
    expect(response.status).toBe(201);
    expect(db.members).toEqual([expect.objectContaining({ conversation_id: "group", user_id: "current-user", role: "member", left_at: null })]);
    expect((await response.json()).conversation).toMatchObject({ id: "group", type, visibility: "public" });
  });

  it.each(["owner", "admin", "member"])("keeps an existing active %s membership unchanged", async (role) => {
    const existing = member(role);
    const db = database(publicGroup, existing);
    getSupabaseAdmin.mockReturnValue(db);
    const response = await join();
    expect(response.status).toBe(200);
    expect(db.members).toEqual([existing]);
    expect(db.writes).toEqual([]);
  });

  it.each(["owner", "admin", "member"])("reactivates a departed %s without replacing its role or join date", async (role) => {
    const db = database(publicGroup, member(role, "2026-10-03"));
    getSupabaseAdmin.mockReturnValue(db);
    const response = await join();
    expect(response.status).toBe(200);
    expect(db.members).toEqual([member(role)]);
    expect(db.writes).toEqual([{ operation: "update", values: { left_at: null } }]);
  });

  it("lets simultaneous first joins succeed with one membership", async () => {
    const db = database(publicGroup, null, { membershipBarrier: true });
    getSupabaseAdmin.mockReturnValue(db);
    const responses = await Promise.all([join(), join()]);
    expect(responses.every((response) => response.ok)).toBe(true);
    expect(db.members).toHaveLength(1);
    expect(db.members[0]).toMatchObject({ user_id: "current-user", role: "member", left_at: null });
  });

  it("preserves a role created between membership lookup and insertion", async () => {
    const db = database(publicGroup, null, { concurrentMember: member("admin", "2026-10-03") });
    getSupabaseAdmin.mockReturnValue(db);
    const response = await join();
    expect(response.ok).toBe(true);
    expect(db.members).toEqual([member("admin")]);
  });

  it("reports a failed membership write", async () => {
    const db = database(publicGroup, null, { writeError: true });
    getSupabaseAdmin.mockReturnValue(db);
    const response = await join();
    expect(response.status).toBe(500);
    expect(db.members).toEqual([]);
  });
});
