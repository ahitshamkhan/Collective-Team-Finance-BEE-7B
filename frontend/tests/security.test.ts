import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { amountSchema, depositSchema } from "../src/server/services/finance";
import { endpoint, json, emailSchema } from "../src/server/http";
import { generateCsrfToken } from "../src/server/auth/csrf";

vi.stubEnv("DATABASE_URL", "postgresql://unused:unused@localhost/unused");
vi.stubEnv("JWT_SECRET", "j".repeat(32));
vi.stubEnv("CSRF_HMAC_KEY", "c".repeat(32));
vi.stubEnv("RATE_LIMIT_HMAC_KEY", "r".repeat(32));
vi.stubEnv("PUBLIC_ORIGIN", "http://localhost:3000");
vi.stubEnv("COOKIE_SECURE", "false");
describe("strict financial inputs", () => {
  it.each([
    0.1,
    "0",
    "-1",
    "1e2",
    "NaN",
    "Infinity",
    "1.001",
    "1000000000000",
    "01.00",
  ])("rejects invalid money %s", (value) =>
    expect(amountSchema.safeParse(value).success).toBe(false),
  );
  it("normalizes without floating point", () =>
    expect(amountSchema.parse("999999999999.99")).toBe("999999999999.99"));
  it("rejects injected actor fields", () =>
    expect(
      depositSchema.safeParse({
        member_id: "a",
        amount: "1",
        payment_date: "2026-11-27",
        description: "test",
        recorded_by: "attacker",
      }).success,
    ).toBe(false));
  it("normalizes email case", () =>
    expect(emailSchema.parse("Member@EXAMPLE.test")).toBe(
      "member@example.test",
    ));
});
describe("HTTP mutation security", () => {
  it.each([undefined, "https://foreign.example"])(
    "denies absent or foreign Origin %s",
    async (origin) => {
      const headers = new Headers({ "content-type": "application/json" });
      if (origin) headers.set("origin", origin);
      const work = vi.fn(async () => json({ ok: true }));
      const response = await endpoint(
        new NextRequest("http://localhost:3000/api/v1/auth/login", {
          method: "POST",
          headers,
          body: "{}",
        }),
        work,
      );
      expect(response.status).toBe(403);
      expect(work).not.toHaveBeenCalled();
    },
  );
  it("requires the matching bound CSRF token", async () => {
    const browser = "synthetic-browser";
    const token = generateCsrfToken(browser);
    const request = (value: string) =>
      new NextRequest("http://localhost:3000/api/v1/auth/login", {
        method: "POST",
        headers: {
          origin: "http://localhost:3000",
          "content-type": "application/json",
          "x-csrf-token": value,
          cookie: `cfp_browser=${browser}; cfp_csrf=${token}`,
        },
        body: "{}",
      });
    expect(
      (await endpoint(request(token), async () => json({ ok: true }))).status,
    ).toBe(200);
    expect(
      (
        await endpoint(request(generateCsrfToken("other-browser")), async () =>
          json({ ok: true }),
        )
      ).status,
    ).toBe(403);
  });
});
