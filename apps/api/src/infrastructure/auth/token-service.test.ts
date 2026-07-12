import { describe, expect, it } from "vitest";
import { TokenService } from "./token-service.js";

describe("TokenService", () => {
  it("hashes opaque tokens deterministically without storing the raw token", () => {
    const service = new TokenService();
    const token = service.createRefreshToken();

    expect(token).toHaveLength(64);
    expect(service.hashToken(token)).toEqual(service.hashToken(token));
    expect(service.hashToken(token)).not.toEqual(token);
  });
});
