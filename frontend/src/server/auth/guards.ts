import "server-only";
import { cookies } from "next/headers";
import { getPrisma } from "../db/prisma";
import { verifyToken } from "./jwt";
import { loadSession } from "./session";
import { AppError } from "../errors/app-error";

export interface AuthContext {
  userId: string;
  sessionId: string;
  kind: "full" | "status";
  expiresAt: Date;
  adminOtpAt: Date | null;
  user: {
    id: string;
    emailNormalized: string;
    name: string;
    status: string;
    memberId: string | null;
  };
  isAdmin: boolean;
}

function getSessionCookieName(): string {
  const secure = process.env.COOKIE_SECURE === "true";
  return secure ? "__Host-cfp_session" : "cfp_session";
}

/**
 * Extract and validate authentication from the request cookies.
 * Returns null if no valid session exists (no throw for missing auth).
 */
async function extractAuth(): Promise<AuthContext | null> {
  const cookieStore = await cookies();
  const cookieName = getSessionCookieName();
  const token = cookieStore.get(cookieName)?.value;

  if (!token) return null;

  const verified = await verifyToken(token);
  if (!verified) return null;

  const session = await loadSession(verified.sid, verified.sub);
  if (!session) return null;

  const prisma = getPrisma();
  const user = await prisma.user.findUnique({
    where: { id: verified.sub },
    select: {
      id: true,
      emailNormalized: true,
      name: true,
      status: true,
      memberId: true,
    },
  });

  if (!user) return null;

  // Suspended users cannot access any protected resource
  if (user.status === "suspended") return null;

  // Check admin authorization from the fixed authorized_admins table
  let isAdmin = false;
  if (
    user.status === "approved" &&
    user.memberId &&
    session.kind === "full" &&
    session.adminOtpAt
  ) {
    const adminRow = await prisma.authorizedAdmin.findFirst({
      where: {
        memberId: user.memberId,
        emailNormalized: user.emailNormalized,
      },
    });
    isAdmin = adminRow !== null;
  }

  return {
    userId: user.id,
    sessionId: session.sessionId,
    kind: session.kind,
    expiresAt: session.expiresAt,
    adminOtpAt: session.adminOtpAt,
    user,
    isAdmin,
  };
}

/**
 * Require any valid session (full or status).
 * Use for endpoints that need to know the user identity.
 */
export async function requireStatusOrFull(): Promise<AuthContext> {
  const auth = await extractAuth();
  if (!auth) throw AppError.unauthorized();
  return auth;
}

/**
 * Require a full session for an approved, verified, member-linked user.
 * No roster or financial access for status sessions.
 */
export async function requireMember(): Promise<AuthContext> {
  const auth = await extractAuth();
  if (!auth) throw AppError.unauthorized();
  if (auth.kind !== "full") {
    throw AppError.forbidden(
      "A full session is required for this action.",
      "INSUFFICIENT_SESSION",
    );
  }
  if (auth.user.status !== "approved") {
    throw AppError.forbidden(
      "Your account is not approved for this action.",
      "ACCOUNT_NOT_APPROVED",
    );
  }
  if (!auth.user.memberId) {
    throw AppError.forbidden(
      "Your account is not linked to a member record.",
      "MEMBER_NOT_LINKED",
    );
  }
  return auth;
}

/**
 * Require a full admin session with completed OTP verification.
 * Derives admin from the fixed authorized_admins table.
 */
export async function requireAdmin(): Promise<AuthContext> {
  const auth = await requireMember();
  if (!auth.isAdmin) {
    throw AppError.forbidden(
      "You do not have permission to perform this action.",
      "NOT_ADMIN",
    );
  }
  if (!auth.adminOtpAt) {
    throw AppError.forbidden(
      "Administrator OTP verification is required.",
      "ADMIN_OTP_REQUIRED",
    );
  }
  return auth;
}
