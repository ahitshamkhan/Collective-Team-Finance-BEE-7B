import "server-only";
import { randomUUID } from "node:crypto";
import { getPrisma } from "../db/prisma";
import { getEnv } from "../config/env";
import { signToken } from "./jwt";
import { sessionCookie } from "./cookies";
import type { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";

export interface SessionInfo {
  sessionId: string;
  userId: string;
  kind: "full" | "status";
  expiresAt: Date;
  adminOtpAt: Date | null;
}

/**
 * Create a new session row in the database and return a signed JWT cookie.
 */
export async function createSession(
  userId: string,
  kind: "full" | "status",
  adminOtpAt?: Date,
): Promise<{ cookie: ResponseCookie; session: SessionInfo }> {
  const env = getEnv();
  const prisma = getPrisma();

  let lifetimeSeconds: number;
  switch (kind) {
    case "full":
      lifetimeSeconds = adminOtpAt
        ? env.ADMIN_SESSION_SECONDS
        : env.MEMBER_SESSION_SECONDS;
      break;
    case "status":
      lifetimeSeconds = env.STATUS_SESSION_SECONDS;
      break;
  }

  const sessionId = randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + lifetimeSeconds * 1000);

  await prisma.session.create({
    data: {
      id: sessionId,
      userId,
      kind,
      expiresAt,
      adminOtpAt: adminOtpAt ?? null,
    },
  });

  const jwt = await signToken(
    { sub: userId, sid: sessionId },
    lifetimeSeconds,
  );

  return {
    cookie: sessionCookie(jwt, lifetimeSeconds),
    session: {
      sessionId,
      userId,
      kind,
      expiresAt,
      adminOtpAt: adminOtpAt ?? null,
    },
  };
}

/**
 * Load a session from the database and validate it is still active.
 * Returns null for expired, revoked, or missing sessions.
 */
export async function loadSession(
  sessionId: string,
  userId: string,
): Promise<SessionInfo | null> {
  const prisma = getPrisma();

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
  });

  if (!session) return null;
  if (session.userId !== userId) return null;
  if (session.revokedAt !== null) return null;
  if (session.expiresAt <= new Date()) return null;
  if (session.kind !== "full" && session.kind !== "status") return null;

  return {
    sessionId: session.id,
    userId: session.userId,
    kind: session.kind as "full" | "status",
    expiresAt: session.expiresAt,
    adminOtpAt: session.adminOtpAt,
  };
}

/**
 * Revoke a single session.
 */
export async function revokeSession(sessionId: string): Promise<void> {
  const prisma = getPrisma();
  await prisma.session.update({
    where: { id: sessionId },
    data: { revokedAt: new Date() },
  });
}

/**
 * Revoke all sessions for a user.
 */
export async function revokeAllSessions(userId: string): Promise<void> {
  const prisma = getPrisma();
  await prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
