import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getEnv } from "../config/env";
import { z } from "zod";

const CSRF_VERSION = "v1";
const CSRF_LIFETIME_SECONDS = 1800; // 30 minutes

const csrfPayload = z
  .object({
    v: z.literal("v1"),
    n: z.string().min(1),
    e: z.number().int(),
    b: z.string().min(1),
  })
  .strict();

function hmacSign(data: string): string {
  const env = getEnv();
  return createHmac("sha256", env.CSRF_HMAC_KEY)
    .update(data)
    .digest("base64url");
}

/**
 * Generate a CSRF token bound to the given binding value
 * (browser cookie before login, session ID after login).
 */
export function generateCsrfToken(
  binding: string,
  maxAgeSeconds = CSRF_LIFETIME_SECONDS,
): string {
  const nonce = randomBytes(16).toString("base64url");
  const expiresAt =
    Math.floor(Date.now() / 1000) +
    Math.min(CSRF_LIFETIME_SECONDS, maxAgeSeconds);

  const payload = JSON.stringify({
    v: CSRF_VERSION,
    n: nonce,
    e: expiresAt,
    b: createHmac("sha256", getEnv().CSRF_HMAC_KEY)
      .update(binding)
      .digest("base64url"),
  });

  const encoded = Buffer.from(payload).toString("base64url");
  const signature = hmacSign(encoded);

  return `${encoded}.${signature}`;
}

/**
 * Verify a CSRF token against the expected binding.
 * Returns true if valid, false for any verification failure.
 */
export function verifyCsrfToken(
  token: string,
  expectedBinding: string,
): boolean {
  try {
    const dotIndex = token.lastIndexOf(".");
    if (dotIndex <= 0) return false;

    const encoded = token.substring(0, dotIndex);
    const signature = token.substring(dotIndex + 1);

    // Verify signature in constant time
    const expectedSig = hmacSign(encoded);
    const sigBuf = Buffer.from(signature, "base64url");
    const expectedBuf = Buffer.from(expectedSig, "base64url");
    if (sigBuf.length !== expectedBuf.length) return false;
    if (!timingSafeEqual(sigBuf, expectedBuf)) return false;

    // Decode and validate payload
    const parsed = csrfPayload.parse(
      JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")),
    );
    const exp = parsed.e;
    if (exp <= Math.floor(Date.now() / 1000)) {
      return false;
    }

    // Verify binding in constant time
    const expectedBindingHash = createHmac("sha256", getEnv().CSRF_HMAC_KEY)
      .update(expectedBinding)
      .digest("base64url");
    const tokenBinding = parsed.b;
    if (typeof tokenBinding !== "string") return false;

    const bindBuf = Buffer.from(tokenBinding, "base64url");
    const expectBuf = Buffer.from(expectedBindingHash, "base64url");
    if (bindBuf.length !== expectBuf.length) return false;
    return timingSafeEqual(bindBuf, expectBuf);
  } catch {
    return false;
  }
}

/**
 * Generate a random browser cookie value for anonymous CSRF binding.
 */
export function generateBrowserId(): string {
  return randomBytes(32).toString("base64url");
}
