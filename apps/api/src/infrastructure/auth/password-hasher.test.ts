import { describe, expect, it } from "vitest";
import { PasswordHasher } from "./password-hasher.js";

describe("PasswordHasher", () => {
  it("creates bcrypt-compatible hashes and verifies passwords", async () => {
    const hasher = new PasswordHasher();
    const hash = await hasher.hash("correct-horse-battery-staple");

    expect(hash.startsWith("$2")).toBe(true);
    await expect(hasher.verify("correct-horse-battery-staple", hash)).resolves.toBe(true);
    await expect(hasher.verify("wrong-password", hash)).resolves.toBe(false);
  });
});
