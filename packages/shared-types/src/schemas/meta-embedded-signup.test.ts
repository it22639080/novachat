import { describe, expect, it } from "vitest";
import {
  metaEmbeddedSignupCallbackSchema,
  metaEmbeddedSignupDisconnectSchema
} from "./meta-embedded-signup.js";

describe("meta embedded signup schemas", () => {
  it("requires authorization data for callback payloads", () => {
    const parsed = metaEmbeddedSignupCallbackSchema.safeParse({
      phoneNumberId: "123456789",
      wabaId: "987654321"
    });

    expect(parsed.success).toBe(false);
  });

  it("accepts a callback payload without exposing frontend secrets beyond the Meta result", () => {
    const parsed = metaEmbeddedSignupCallbackSchema.parse({
      code: "embedded-signup-code",
      phoneNumberId: "123456789",
      wabaId: "987654321",
      businessId: "456",
      rawResult: { source: "facebook-sdk" }
    });

    expect(parsed.phoneNumberId).toBe("123456789");
    expect(parsed.wabaId).toBe("987654321");
  });

  it("validates disconnect payloads with UUID account IDs", () => {
    const parsed = metaEmbeddedSignupDisconnectSchema.safeParse({
      accountId: "not-a-uuid"
    });

    expect(parsed.success).toBe(false);
  });
});
