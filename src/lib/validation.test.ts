import { describe, expect, it } from "vitest";
import { loginSchema, normalizeUsername, registerSchema } from "./validation";

describe("validation", () => {
  it("normalizes accepted usernames and rejects unsafe values", () => {
    expect(normalizeUsername(" Shahab_Gram ")).toBe("shahab_gram");
    expect(registerSchema.safeParse({ username: "shahab_gram", password: "12345678", displayName: "Shahab" }).success).toBe(true);
    expect(loginSchema.safeParse({ username: "bad space", password: "12345678" }).success).toBe(false);
  });
});
