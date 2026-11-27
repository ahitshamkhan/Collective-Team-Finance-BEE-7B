import "server-only";
import { createHmac } from "node:crypto";
import { getPrisma } from "../db/prisma";
import { getEnv } from "../config/env";

/**
 * Database-backed rate limiting using the rate_limit_buckets table.
 * Uses fixed UTC windows and atomic PostgreSQL upsert/increment.
 */

function hashKey(raw: string): string {
  const env = getEnv();
  return createHmac("sha256", env.RATE_LIMIT_HMAC_KEY)
    .update(raw)
    .digest("base64url");
}

function windowStart(windowSeconds: number): Date {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  return new Date(Math.floor(now / windowMs) * windowMs);
}

export interface RateLimitConfig {
  /** Descriptive prefix for the bucket key */
  prefix: string;
  /** Maximum allowed count within the window */
  maxCount: number;
  /** Window size in seconds */
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Check and increment a rate limit counter atomically.
 * Uses HMAC-hashed keys so raw PII is never stored.
 */
export async function checkRateLimit(
  config: RateLimitConfig,
  identifier: string,
): Promise<RateLimitResult> {
  const prisma = getPrisma();
  const key = hashKey(`${config.prefix}:${identifier}`);
  const ws = windowStart(config.windowSeconds);
  const expiresAt = new Date(ws.getTime() + config.windowSeconds * 1000);

  // Atomic upsert + increment
  const bucket = await prisma.rateLimitBucket.upsert({
    where: {
      key_windowStart: { key, windowStart: ws },
    },
    create: {
      key,
      windowStart: ws,
      count: 1,
      expiresAt,
    },
    update: {
      count: { increment: 1 },
    },
  });

  const allowed = bucket.count <= config.maxCount;
  const remaining = Math.max(0, config.maxCount - bucket.count);
  const retryAfterSeconds = allowed
    ? 0
    : Math.ceil((expiresAt.getTime() - Date.now()) / 1000);

  return { allowed, remaining, retryAfterSeconds };
}

/** Predefined rate limit configurations from the identity contract */
export const RATE_LIMITS = {
  passwordLogin: {
    account: { prefix: "login:acct", maxCount: 5, windowSeconds: 900 },
    ip: { prefix: "login:ip", maxCount: 30, windowSeconds: 900 },
  },
  registration: {
    account: { prefix: "reg:acct", maxCount: 3, windowSeconds: 3600 },
    ip: { prefix: "reg:ip", maxCount: 10, windowSeconds: 3600 },
  },
  otpSend: {
    account: { prefix: "otp:acct", maxCount: 5, windowSeconds: 3600 },
    ip: { prefix: "otp:ip", maxCount: 20, windowSeconds: 3600 },
  },
  otpVerify: {
    ip: { prefix: "otpv:ip", maxCount: 30, windowSeconds: 900 },
  },
  recovery: {
    account: { prefix: "recv:acct", maxCount: 3, windowSeconds: 3600 },
    ip: { prefix: "recv:ip", maxCount: 10, windowSeconds: 3600 },
  },
} as const;
