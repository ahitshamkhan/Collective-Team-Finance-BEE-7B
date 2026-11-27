import "server-only";
import { randomUUID } from "node:crypto";
import type { Tx } from "../db/mutation";
import { mutate } from "../db/mutation";
import { getPrisma } from "../db/prisma";
import { AppError } from "../errors/app-error";
import { hashPassword, verifyPassword, needsRehash } from "../auth/password";
import { signToken } from "../auth/jwt";
import { getEnv } from "../config/env";
import { consumeChallenge, startChallenge, throttle } from "./otp";
import type { Prisma, User } from "../../generated/prisma/client";

export async function audit(
  tx: Tx,
  actor: Pick<User, "id" | "name">,
  operation: string,
  entityType: string,
  entityId: string,
  requestId: string,
  before?: Prisma.InputJsonObject,
  after?: Prisma.InputJsonObject,
  reason?: string,
) {
  await tx.auditEvent.create({
    data: {
      id: randomUUID(),
      actorKind: "user",
      actorUserId: actor.id,
      actorLabel: actor.name,
      operation,
      entityType,
      entityId,
      requestId,
      beforeValues: before,
      afterValues: after,
      reason,
    },
  });
}
export function registrationView(u: User) {
  return {
    id: u.id,
    name: u.name,
    email: u.emailNormalized,
    status: u.status,
    email_verified_at: u.emailVerifiedAt?.toISOString() ?? null,
    member_id: u.memberId,
    version: u.version,
    created_at: u.createdAt.toISOString(),
    reviewed_by: u.reviewedBy,
    reviewed_at: u.reviewedAt?.toISOString() ?? null,
    review_reason: u.reviewReason,
  };
}
export async function authority(
  tx: Tx,
  sessionId: string,
  permission: "self" | "member" | "admin",
) {
  const s = await tx.session.findUnique({
    where: { id: sessionId },
    include: { user: true },
  });
  if (
    !s ||
    s.revokedAt ||
    s.expiresAt <= new Date() ||
    s.user.status === "suspended"
  )
    throw AppError.unauthorized();
  const u = s.user;
  const reserved = await tx.authorizedAdmin.findFirst({
    where: {
      OR: [
        { emailNormalized: u.emailNormalized },
        ...(u.memberId ? [{ memberId: u.memberId }] : []),
      ],
    },
  });
  const isAdmin =
    !!reserved &&
    reserved.emailNormalized === u.emailNormalized &&
    reserved.memberId === u.memberId &&
    !!s.adminOtpAt;
  if (
    s.kind === "full" &&
    (u.status !== "approved" ||
      !u.emailVerifiedAt ||
      !u.memberId ||
      (reserved && !isAdmin))
  )
    throw AppError.unauthorized();
  if (
    s.kind === "status" &&
    !["pending", "rejected", "approved"].includes(u.status)
  )
    throw AppError.unauthorized();
  if (permission !== "self" && s.kind !== "full") throw AppError.forbidden();
  if (permission === "admin" && !isAdmin) throw AppError.forbidden();
  return { session: s, user: u, isAdmin };
}
export function selfView(a: Awaited<ReturnType<typeof authority>>) {
  return {
    user_id: a.user.id,
    name: a.user.name,
    email: a.user.emailNormalized,
    status: a.user.status,
    role: a.isAdmin ? "admin" : "member",
    member_id: a.user.memberId,
    session_kind: a.session.kind,
    session_expires_at: a.session.expiresAt.toISOString(),
  };
}
async function establish(
  tx: Tx,
  u: User,
  admin: boolean,
  previousSession?: string,
) {
  const kind = u.status === "approved" ? "full" : "status";
  const env = getEnv();
  const seconds =
    kind === "status"
      ? env.STATUS_SESSION_SECONDS
      : admin
        ? env.ADMIN_SESSION_SECONDS
        : env.MEMBER_SESSION_SECONDS;
  const now = new Date();
  if (previousSession)
    await tx.session.updateMany({
      where: { id: previousSession, revokedAt: null },
      data: { revokedAt: now },
    });
  const session = await tx.session.create({
    data: {
      id: randomUUID(),
      userId: u.id,
      kind,
      expiresAt: new Date(now.getTime() + seconds * 1000),
      adminOtpAt: admin ? now : null,
    },
  });
  const token = await signToken({ sub: u.id, sid: session.id }, seconds);
  return {
    token,
    seconds,
    sessionId: session.id,
    view: selfView({
      user: u,
      session: { ...session, user: u },
      isAdmin: admin,
    }),
  };
}
export async function register(
  input: { name: string; email: string; password: string },
  ip: string,
) {
  await throttle("registration", input.email, ip);
  const passwordHash = await hashPassword(input.password);
  const user = await mutate(async (tx) => {
    if (
      (await tx.user.findUnique({ where: { emailNormalized: input.email } })) ||
      (await tx.authorizedAdmin.findUnique({
        where: { emailNormalized: input.email },
      }))
    )
      return null;
    return tx.user.create({
      data: {
        id: randomUUID(),
        emailNormalized: input.email,
        name: input.name,
        passwordHash,
        status: "unverified",
      },
    });
  });
  return startChallenge(user?.id ?? null, input.email, "registration", ip);
}
let dummyHash: Promise<string> | undefined;
export async function login(
  input: { email: string; password: string },
  ip: string,
  previousSession?: string,
) {
  await throttle("passwordLogin", input.email, ip);
  const user = await getPrisma().user.findUnique({
    where: { emailNormalized: input.email },
  });
  dummyHash ??= hashPassword(randomUUID());
  const valid = await verifyPassword(
    input.password,
    user?.passwordHash ?? (await dummyHash),
  );
  if (!user || !valid) throw AppError.unauthorized("Invalid credentials.");
  const rehash = needsRehash(user.passwordHash)
    ? await hashPassword(input.password)
    : undefined;
  const result = await mutate(async (tx) => {
    const u = await tx.user.findUniqueOrThrow({ where: { id: user.id } });
    if (u.passwordHash !== user.passwordHash)
      throw AppError.unauthorized("Invalid credentials.");
    if (u.status === "suspended")
      throw AppError.forbidden("Account unavailable.");
    const reserved = await tx.authorizedAdmin.findFirst({
      where: {
        OR: [
          { emailNormalized: u.emailNormalized },
          ...(u.memberId ? [{ memberId: u.memberId }] : []),
        ],
      },
    });
    if (rehash)
      await tx.user.update({
        where: { id: u.id },
        data: { passwordHash: rehash },
      });
    if (reserved) {
      if (
        u.status !== "approved" ||
        reserved.emailNormalized !== u.emailNormalized ||
        reserved.memberId !== u.memberId
      )
        throw AppError.forbidden("Account unavailable.");
      return { purpose: "admin_login" as const };
    }
    if (u.status === "unverified") return { purpose: "registration" as const };
    if (!u.emailVerifiedAt || (u.status === "approved" && !u.memberId))
      throw AppError.forbidden("Account unavailable.");
    return { session: await establish(tx, u, false, previousSession) };
  });
  if ("purpose" in result && result.purpose)
    return {
      flow: await startChallenge(
        user.id,
        user.emailNormalized,
        result.purpose,
        ip,
        undefined,
        rehash ?? user.passwordHash,
      ),
    };
  return result;
}
export async function verifyOtp(
  flow: string | undefined,
  code: string,
  ip: string,
  requestId: string,
  previousSession?: string,
) {
  return consumeChallenge(
    flow,
    code,
    ["registration", "admin_login"],
    ip,
    async (tx, row) => {
      let u = await tx.user.findUniqueOrThrow({ where: { id: row.userId } });
      const admin = row.purpose === "admin_login";
      if (admin) {
        if (
          u.status !== "approved" ||
          !u.memberId ||
          !(await tx.authorizedAdmin.findFirst({
            where: { memberId: u.memberId, emailNormalized: u.emailNormalized },
          }))
        )
          throw AppError.forbidden();
      } else if (u.status !== "unverified") throw AppError.forbidden();
      u = await tx.user.update({
        where: { id: u.id },
        data: {
          emailVerifiedAt: u.emailVerifiedAt ?? new Date(),
          ...(admin ? {} : { status: "pending" }),
          version: { increment: 1 },
        },
      });
      const session = await establish(tx, u, admin, previousSession);
      await audit(
        tx,
        u,
        admin ? "admin.login" : "registration.verify",
        "user",
        u.id,
        requestId,
        undefined,
        { status: u.status },
      );
      return session;
    },
  );
}
export async function recover(email: string, ip: string) {
  await throttle("recovery", email, ip);
  const user = await getPrisma().user.findUnique({
    where: { emailNormalized: email },
  });
  return startChallenge(user?.id ?? null, email, "recovery", ip);
}
export async function resetPassword(
  flow: string | undefined,
  code: string,
  password: string,
  ip: string,
  requestId: string,
) {
  // Throttle before expensive password hashing, independently of challenge validity.
  const { checkRateLimit, RATE_LIMITS } = await import("../auth/rate-limit");
  const limit = await checkRateLimit(RATE_LIMITS.passwordLogin.ip, ip);
  if (!limit.allowed) throw AppError.rateLimited(limit.retryAfterSeconds);
  const passwordHash = await hashPassword(password);
  return consumeChallenge(flow, code, ["recovery"], ip, async (tx, row) => {
    const u = await tx.user.update({
      where: { id: row.userId },
      data: { passwordHash, version: { increment: 1 } },
    });
    await tx.session.updateMany({
      where: { userId: u.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await tx.otpChallenge.updateMany({
      where: {
        userId: u.id,
        id: { not: row.id },
        consumedAt: null,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
    await audit(tx, u, "password.reset", "user", u.id, requestId);
  });
}
export async function changePassword(
  sessionId: string,
  current: string,
  password: string,
  ip: string,
  requestId: string,
) {
  const a = await authority(getPrisma(), sessionId, "member");
  await throttle("passwordLogin", a.user.emailNormalized, ip);
  if (!(await verifyPassword(current, a.user.passwordHash)))
    throw AppError.badRequest(
      "INVALID_PASSWORD",
      "Incorrect current password.",
    );
  const passwordHash = await hashPassword(password);
  await mutate(async (tx) => {
    const locked = await authority(tx, sessionId, "member");
    if (locked.user.passwordHash !== a.user.passwordHash)
      throw AppError.conflict(
        "STALE_VERSION",
        "Account changed. Please retry.",
      );
    await tx.user.update({
      where: { id: a.user.id },
      data: { passwordHash, version: { increment: 1 } },
    });
    await tx.session.updateMany({
      where: { userId: a.user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await tx.otpChallenge.updateMany({
      where: { userId: a.user.id, consumedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await audit(tx, a.user, "password.change", "user", a.user.id, requestId);
  });
}
export async function reviewUser(
  sessionId: string,
  id: string,
  action: "approve" | "reject" | "suspend" | "restore",
  input: { expected_version: number; member_id?: string; reason?: string },
  requestId: string,
) {
  return mutate(async (tx) => {
    const a = await authority(tx, sessionId, "admin");
    const u = await tx.user.findUnique({ where: { id } });
    if (!u) throw AppError.notFound();
    if (u.version !== input.expected_version)
      throw AppError.conflict(
        "STALE_VERSION",
        "Account changed. Please reload.",
      );
    const data: Prisma.UserUncheckedUpdateInput = { version: { increment: 1 } };
    if (action === "approve" || action === "reject") {
      if (u.status !== "pending" || !u.emailVerifiedAt)
        throw AppError.conflict(
          "INVALID_TRANSITION",
          "Only verified pending applications can be reviewed.",
        );
      if (action === "approve") {
        const member = await tx.member.findUnique({
          where: { id: input.member_id },
          include: { user: true, authorizedAdmin: true },
        });
        if (!member || member.user || member.authorizedAdmin)
          throw AppError.conflict(
            "MEMBER_UNAVAILABLE",
            "Member cannot be linked.",
          );
        data.memberId = member.id;
      }
      data.status = action === "approve" ? "approved" : "rejected";
      data.reviewedBy = a.user.id;
      data.reviewedAt = new Date();
      data.reviewReason = input.reason ?? null;
    } else {
      const reserved = await tx.authorizedAdmin.findFirst({
        where: {
          OR: [
            { emailNormalized: u.emailNormalized },
            ...(u.memberId ? [{ memberId: u.memberId }] : []),
          ],
        },
      });
      if (reserved)
        throw AppError.forbidden(
          "Administrator accounts can only be suspended or restored by an operator.",
          "ADMIN_OPERATOR_ONLY",
        );
      if (action === "suspend") {
        if (u.status === "suspended")
          throw AppError.conflict(
            "INVALID_TRANSITION",
            "Account is already suspended.",
          );
        data.status = "suspended";
        data.statusBeforeSuspension = u.status;
        await tx.session.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        await tx.otpChallenge.updateMany({
          where: { userId: id, consumedAt: null, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      } else {
        if (u.status !== "suspended" || !u.statusBeforeSuspension)
          throw AppError.conflict(
            "INVALID_TRANSITION",
            "Account is not suspended.",
          );
        data.status = u.statusBeforeSuspension;
        data.statusBeforeSuspension = null;
      }
    }
    const updated = await tx.user.update({ where: { id }, data });
    await audit(
      tx,
      a.user,
      `user.${action}`,
      "user",
      id,
      requestId,
      { status: u.status, member_id: u.memberId },
      { status: updated.status, member_id: updated.memberId },
      input.reason,
    );
    return registrationView(updated);
  });
}
