import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../app.js";
import { authCookieNames } from "../../shared/http/cookies.js";

function errorCode(response: { body: { error?: { code?: string } } }) {
  return response.body.error?.code;
}

describe("API security middleware", () => {
  it("sets defensive security headers", async () => {
    const response = await request(createApp()).get("/api/v1/health");

    expect(response.status).toBe(200);
    expect(response.headers["x-powered-by"]).toBeUndefined();
    expect(response.headers["x-content-type-options"]).toBe("nosniff");
    expect(response.headers["x-frame-options"]).toBe("SAMEORIGIN");
    expect(response.headers["content-security-policy"]).toContain("default-src 'none'");
  });

  it("rejects disallowed CORS origins", async () => {
    const response = await request(createApp())
      .get("/api/v1/health")
      .set("Origin", "https://evil.example");

    expect(response.status).toBe(403);
    expect(errorCode(response)).toBe("CORS_ORIGIN_DENIED");
  });

  it("requires a CSRF marker for cookie-authenticated writes", async () => {
    const response = await request(createApp())
      .post("/api/v1/auth/logout")
      .set("Cookie", [`${authCookieNames.accessToken}=fake`]);

    expect(response.status).toBe(403);
    expect(errorCode(response)).toBe("CSRF_TOKEN_REQUIRED");
  });

  it("allows the CSRF marker through to the route handler", async () => {
    const response = await request(createApp())
      .post("/api/v1/auth/logout")
      .set("Cookie", [`${authCookieNames.accessToken}=fake`])
      .set("x-novachat-csrf", "same-origin");

    expect(response.status).toBe(200);
  });

  it("rejects prototype pollution keys", async () => {
    const response = await request(createApp())
      .post("/api/v1/auth/login")
      .set("x-novachat-csrf", "same-origin")
      .send({ email: "owner@example.com", password: "Password-2026!", constructor: { prototype: { polluted: true } } });

    expect(response.status).toBe(400);
    expect(errorCode(response)).toBe("BAD_REQUEST");
  });
});
