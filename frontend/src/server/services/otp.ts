import "server-only";
import {
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { z } from "zod";
import { getPrisma } from "../db/prisma";
import { mutate, type Tx } from "../db/mutation";
import { AppError } from "../errors/app-error";
import { checkRateLimit, RATE_LIMITS } from "../auth/rate-limit";
import { sendOtp, type OtpMailer } from "./mail";
import type { OtpChallenge } from "../../generated/prisma/client";
import { getEnv } from "../config/env";

export type Purpose = "registration" | "admin_login" | "recovery";
export const challengeResult = {
  next_step: "verify",
  expires_in_seconds: 300,
  resend_after_seconds: 60,
};
export const invalidChallenge = () =>
  AppError.badRequest("INVALID_CHALLENGE", "Invalid or expired challenge.");
export const digestFlow = (secret: string) =>
  createHash("sha256").update(secret).digest();
const emailKey = (email: string) =>
  createHmac("sha256", getEnv().RATE_LIMIT_HMAC_KEY)
    .update(email)
    .digest("hex");
async function sendCooldown(tx: Tx, accountKey: string, purpose: string) {
  const key = `otp-cooldown:${accountKey}:${purpose}`;
  const windowStart = new Date(0);
  const now = new Date();
  const old = await tx.rateLimitBucket.findUnique({
    where: { key_windowStart: { key, windowStart } },
  });
  if (old && old.expiresAt > now)
    throw AppError.rateLimited(
      (old.expiresAt.getTime() - now.getTime()) / 1000,
    );
  await tx.rateLimitBucket.upsert({
    where: { key_windowStart: { key, windowStart } },
    create: {
      key,
      windowStart,
      count: 1,
      expiresAt: new Date(now.getTime() + 60000),
    },
    update: { expiresAt: new Date(now.getTime() + 60000) },
  });
}
export const equalBytes = (a: Uint8Array, b: Uint8Array) =>
  a.length === b.length && timingSafeEqual(a, b);
export function otpHmac(
  id: string,
  purpose: string,
  generation: number,
  code: string,
) {
  const key = z.string().min(32).parse(process.env.OTP_HMAC_KEY);
  return createHmac("sha256", key)
    .update(JSON.stringify([id, purpose, generation, code]))
    .digest();
}
export async function throttle(
  kind: "registration" | "passwordLogin" | "recovery" | "otpSend",
  email: string,
  ip: string,
) {
  const limits = RATE_LIMITS[kind];
  const results = await Promise.all([
    checkRateLimit(limits.account, email),
    checkRateLimit(limits.ip, ip),
  ]);
  const denied = results.find((r) => !r.allowed);
  if (denied) throw AppError.rateLimited(denied.retryAfterSeconds);
}
export async function readFlow(tx: Tx, flow: string | undefined) {
  const parts = flow?.split(".");
  if (
    !parts ||
    parts.length !== 2 ||
    !z.uuid().safeParse(parts[0]).success ||
    !/^[A-Za-z0-9_-]{43}$/.test(parts[1])
  )
    throw invalidChallenge();
  const row = await tx.otpChallenge.findUnique({
    where: { id: parts[0] },
    include: { user: true },
  });
  if (!row || !equalBytes(row.flowSecretHash, digestFlow(parts[1])))
    throw invalidChallenge();
  return row;
}
async function deliver(
  row: OtpChallenge,
  email: string | null,
  code: string,
  mailer: OtpMailer,
) {
  if (!email) return;
  let deliveryState = "sent";
  try {
    await mailer(email, code);
  } catch {
    deliveryState = "failed";
  }
  await getPrisma().otpChallenge.updateMany({
    where: {
      id: row.id,
      generation: row.generation,
      consumedAt: null,
      revokedAt: null,
    },
    data: { deliveryState },
  });
  // Same outward result for real and dummy flows, including delivery failures.
}
export async function startChallenge(
  userId: string | null,
  email: string,
  purpose: Purpose,
  ip: string,
  mailer: OtpMailer = sendOtp,
  expectedPasswordHash?: string,
) {
  const accountKey = emailKey(email);
  await throttle("otpSend", accountKey, ip);
  const secret = randomBytes(32).toString("base64url");
  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const row = await mutate(async (tx) => {
    const now = new Date();
    if (userId && expectedPasswordHash) {
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (
        !user ||
        user.passwordHash !== expectedPasswordHash ||
        user.status === "suspended"
      )
        throw AppError.unauthorized(
          "Credentials changed. Please log in again.",
        );
    }
    await sendCooldown(tx, accountKey, purpose);
    if (userId) {
      const previous = await tx.otpChallenge.findFirst({
        where: { userId, purpose },
        orderBy: { createdAt: "desc" },
      });
      if (
        previous &&
        previous.attempts >= 5 &&
        previous.revokedAt &&
        now.getTime() - previous.revokedAt.getTime() < 900000
      )
        throw AppError.rateLimited(900);
      if (previous && now.getTime() - previous.lastSentAt.getTime() < 60000)
        throw AppError.rateLimited(60);
      await tx.otpChallenge.updateMany({
        where: { userId, purpose, consumedAt: null, revokedAt: null },
        data: { revokedAt: now },
      });
    }
    const id = randomUUID();
    // An opaque mapping lets dummy flows share the same email limits on resend.
    // No email or flow secret is stored in the rate bucket key.
    await tx.rateLimitBucket.create({
      data: {
        key: `otp-flow:${id}:${accountKey}`,
        windowStart: new Date(0),
        count: 1,
        expiresAt: new Date(now.getTime() + 3600000),
      },
    });
    return tx.otpChallenge.create({
      data: {
        id,
        userId,
        purpose,
        flowSecretHash: digestFlow(secret),
        codeHmac: userId ? otpHmac(id, purpose, 1, code) : null,
        generation: 1,
        attempts: 0,
        expiresAt: new Date(now.getTime() + 300000),
        lastSentAt: now,
        deliveryState: userId ? "pending" : "dummy",
      },
    });
  });
  await deliver(row, userId ? email : null, code, mailer);
  return `${row.id}.${secret}`;
}
export async function resendChallenge(
  flow: string | undefined,
  ip: string,
  mailer: OtpMailer = sendOtp,
) {
  const lookup = await readFlow(getPrisma(), flow);
  const mapping = await getPrisma().rateLimitBucket.findFirst({
    where: { key: { startsWith: `otp-flow:${lookup.id}:` } },
  });
  if (!mapping) throw invalidChallenge();
  const accountKey = mapping.key.split(":")[2];
  await throttle("otpSend", accountKey, ip);
  const secret = randomBytes(32).toString("base64url");
  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const row = await mutate(async (tx) => {
    const old = await readFlow(tx, flow);
    const now = new Date();
    if (old.consumedAt || old.revokedAt || old.attempts >= 5)
      throw invalidChallenge();
    if (now.getTime() - old.lastSentAt.getTime() < 60000)
      throw AppError.rateLimited(60);
    await sendCooldown(tx, accountKey, old.purpose);
    return tx.otpChallenge.update({
      where: { id: old.id },
      data: {
        generation: old.generation + 1,
        flowSecretHash: digestFlow(secret),
        codeHmac: old.userId
          ? otpHmac(old.id, old.purpose, old.generation + 1, code)
          : null,
        expiresAt: new Date(now.getTime() + 300000),
        lastSentAt: now,
        deliveryState: old.userId ? "pending" : "dummy",
      },
    });
  });
  await deliver(row, lookup.user?.emailNormalized ?? null, code, mailer);
  return `${row.id}.${secret}`;
}
export async function consumeChallenge<T>(
  flow: string | undefined,
  code: string,
  purposes: Purpose[],
  ip: string,
  effect: (tx: Tx, row: OtpChallenge & { userId: string }) => Promise<T>,
) {
  const limit = await checkRateLimit(RATE_LIMITS.otpVerify.ip, ip);
  if (!limit.allowed) throw AppError.rateLimited(limit.retryAfterSeconds);
  const result = await mutate(async (tx) => {
    const row = await readFlow(tx, flow);
    const now = new Date();
    if (
      !purposes.some((p) => p === row.purpose) ||
      row.consumedAt ||
      row.revokedAt ||
      row.expiresAt <= now ||
      row.attempts >= 5
    )
      throw invalidChallenge();
    if (
      !row.userId ||
      row.deliveryState !== "sent" ||
      !row.codeHmac ||
      !equalBytes(
        row.codeHmac,
        otpHmac(row.id, row.purpose, row.generation, code),
      )
    ) {
      await tx.otpChallenge.update({
        where: { id: row.id },
        data: {
          attempts: { increment: 1 },
          ...(row.attempts === 4 ? { revokedAt: now } : {}),
        },
      });
      if (row.attempts === 4) {
        const mapping = await tx.rateLimitBucket.findFirst({
          where: { key: { startsWith: `otp-flow:${row.id}:` } },
        });
        if (mapping) {
          const key = `otp-cooldown:${mapping.key.split(":")[2]}:${row.purpose}`;
          await tx.rateLimitBucket.update({
            where: { key_windowStart: { key, windowStart: new Date(0) } },
            data: { expiresAt: new Date(now.getTime() + 900000) },
          });
        }
      }
      return { ok: false as const };
    }
    const value = await effect(tx, { ...row, userId: row.userId });
    await tx.otpChallenge.update({
      where: { id: row.id },
      data: { consumedAt: now },
    });
    return { ok: true as const, value };
  });
  if (!result.ok) throw invalidChallenge();
  return result.value;
}
