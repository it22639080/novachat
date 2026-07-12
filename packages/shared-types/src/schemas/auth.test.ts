import { describe, expect, it } from "vitest";
import { inviteTeamMemberSchema, passwordPolicySchema, registerSchema } from "./auth";

describe("auth schemas", () => {
  it("validates owner registration input", () => {
    const parsed = registerSchema.parse({
      name: "Ayesha Fernando",
      email: "OWNER@ABCFASHION.TEST",
      password: "Strong-password-2026!",
      tenantName: "ABC Fashion"
    });

    expect(parsed.email).toBe("owner@abcfashion.test");
  });

  it("rejects weak passwords", () => {
    expect(() => passwordPolicySchema.parse("strong-password")).toThrow();
  });

  it("prevents inviting super admins or owners through team invite", () => {
    expect(() =>
      inviteTeamMemberSchema.parse({
        email: "admin@example.com",
        role: "SUPER_ADMIN"
      })
    ).toThrow();

    expect(() =>
      inviteTeamMemberSchema.parse({
        email: "owner@example.com",
        role: "OWNER"
      })
    ).toThrow();
  });
});
