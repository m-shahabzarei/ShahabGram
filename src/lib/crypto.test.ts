import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword, hashSessionToken } from "./crypto";

describe("password and session security", () => {
  it("hashes and verifies passwords without storing the raw value", async () => {
    const password = "correct horse battery staple";
    const hash = await hashPassword(password);
    expect(hash).toMatch(/^scrypt:/);
    expect(hash).not.toContain(password);
    expect(await verifyPassword(password, hash)).toBe(true);
    expect(await verifyPassword("wrong password", hash)).toBe(false);
  });
  it("produces deterministic session hashes for lookup", () => {
    expect(hashSessionToken("abc")).toBe(hashSessionToken("abc"));
    expect(hashSessionToken("abc")).not.toBe(hashSessionToken("def"));
  });
});
