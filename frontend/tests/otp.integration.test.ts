import "dotenv/config";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { beforeAll, afterAll, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  db: undefined as PrismaClient | undefined,
  mailbox: new Map<string, string>(),
}));
vi.mock("../src/server/services/mail", () => ({
  sendOtp: async (email: string, code: string) => {
    state.mailbox.set(email, code);
  },
}));
vi.mock("../src/server/db/prisma", () => ({
  getPrisma: () => {
    if (!state.db) throw Error("Test database unavailable");
    return state.db;
  },
}));
import {
  startChallenge,
  consumeChallenge,
  resendChallenge,
} from "../src/server/services/otp";
import {
  register,
  login,
  verifyOtp,
  reviewUser,
  authority,
  recover,
  resetPassword,
} from "../src/server/services/identity";
import { hashPassword } from "../src/server/auth/password";
import {
  financialWrite,
  summary,
  today,
  memberView,
} from "../src/server/services/finance";
import { NextRequest } from "next/server";
import { endpoint } from "../src/server/http";
import { financeApi } from "../src/server/finance-api";
import { authApi } from "../src/server/auth-api";
import { generateCsrfToken } from "../src/server/auth/csrf";

const schema = `test_otp_${randomUUID().replaceAll("-", "")}`;
const admin = new Client({
  connectionString:
    process.env.TEST_DATABASE_URL ??
    process.env.DIRECT_URL ??
    process.env.DATABASE_URL,
});
let created = false;
beforeAll(async () => {
  vi.stubEnv("OTP_HMAC_KEY", "o".repeat(32));
  vi.stubEnv("JWT_SECRET", "j".repeat(32));
  vi.stubEnv("CSRF_HMAC_KEY", "c".repeat(32));
  vi.stubEnv("RATE_LIMIT_HMAC_KEY", "r".repeat(32));
  await admin.connect();
  await admin.query(`CREATE SCHEMA "${schema}"`);
  created = true;
  await admin.query(`SET search_path TO "${schema}"`);
  for (const migration of [
    "20261126195807_init",
    "20261126200132_fix_check_constraint_null_guards",
  ]) {
    await admin.query(
      readFileSync(`prisma/migrations/${migration}/migration.sql`, "utf8"),
    );
  }
  state.db = new PrismaClient({
    adapter: new PrismaPg(
      {
        connectionString:
          process.env.TEST_DATABASE_URL ??
          process.env.DIRECT_URL ??
          process.env.DATABASE_URL,
      },
      { schema },
    ),
  });
}, 30000);
it("Module 13: exact totals, parallel idempotency, immutable history, corrections and rollback", async () => {
  const db = state.db!;
  // The fixture is independent of the Module 12 account lifecycle scenario.
  const group = await db.group.create({
    data: { id: randomUUID(), code: "FIN", name: "Synthetic Finance" },
  });
  const member = await db.member.create({
    data: {
      id: randomUUID(),
      rosterKey: "finance-admin",
      name: "Synthetic Finance Admin",
      groupId: group.id,
    },
  });
  await db.authorizedAdmin.create({
    data: {
      slot: 2,
      memberId: member.id,
      emailNormalized: "finance@example.test",
    },
  });
  const user = await db.user.create({
    data: {
      id: randomUUID(),
      emailNormalized: "finance@example.test",
      name: member.name,
      memberId: member.id,
      status: "approved",
      emailVerifiedAt: new Date(),
      passwordHash: "unused-synthetic-hash",
    },
  });
  const session = await db.session.create({
    data: {
      id: randomUUID(),
      userId: user.id,
      kind: "full",
      adminOtpAt: new Date(),
      expiresAt: new Date(Date.now() + 3600000),
    },
  });
  const payload = {
    member_id: member.id,
    amount: "0.10",
    payment_date: today(),
    description: "Synthetic deposit",
  };
  const key = randomUUID();
  const results = await Promise.all(
    [1, 2].map(() =>
      financialWrite(session.id, "deposit", key, payload, randomUUID()),
    ),
  );
  expect(results[0]).toEqual(results[1]);
  expect(await db.transaction.count()).toBe(1);
  await expect(
    financialWrite(
      session.id,
      "deposit",
      key,
      { ...payload, amount: "0.20" },
      randomUUID(),
    ),
  ).rejects.toMatchObject({ status: 409 });
  await financialWrite(
    session.id,
    "deposit",
    randomUUID(),
    { ...payload, amount: "0.20" },
    randomUUID(),
  );
  expect((await summary(db)).collective_balance).toBe("0.30");
  const original = await db.transaction.findFirstOrThrow({
    where: { amount: "0.10" },
  });
  await expect(
    db.transaction.update({
      where: { id: original.id },
      data: { amount: "1.00" },
    }),
  ).rejects.toThrow();
  await expect(
    db.transaction.delete({ where: { id: original.id } }),
  ).rejects.toThrow();
  // An audit insert failure must roll back both ledger and receipt.
  const before = await db.transaction.count();
  await expect(
    financialWrite(session.id, "deposit", randomUUID(), payload, "not-a-uuid"),
  ).rejects.toThrow();
  expect(await db.transaction.count()).toBe(before);
  const replacementKey = randomUUID();
  await expect(
    financialWrite(
      session.id,
      "replace",
      replacementKey,
      {
        reason: "Synthetic correction",
        replacement: { ...payload, payment_date: "2000-01-01" },
      },
      randomUUID(),
      original.id,
    ),
  ).rejects.toMatchObject({ code: "POLICY_UNRESOLVED" });
  expect(
    (await db.transaction.findUniqueOrThrow({ where: { id: original.id } }))
      .status,
  ).toBe("active");
  await financialWrite(
    session.id,
    "replace",
    replacementKey,
    {
      reason: "Synthetic correction",
      replacement: { ...payload, amount: "0.40" },
    },
    randomUUID(),
    original.id,
  );
  expect((await summary(db)).collective_balance).toBe("0.60");
  expect((await memberView(db, member.id)).contribution).toBe("0.60");
  await expect(
    financialWrite(
      session.id,
      "void",
      randomUUID(),
      { reason: "Already corrected" },
      randomUUID(),
      original.id,
    ),
  ).rejects.toMatchObject({ status: 409 });
  await expect(
    financialWrite(
      session.id,
      "expense",
      randomUUID(),
      {
        title: "Synthetic expense",
        amount: "1.00",
        expense_date: today(),
        category: "collective",
        description: "Policy test",
      },
      randomUUID(),
    ),
  ).rejects.toMatchObject({ code: "POLICY_UNRESOLVED" });
  await db.session.update({
    where: { id: session.id },
    data: { revokedAt: new Date() },
  });
  // Authorization is checked before an otherwise valid stored receipt is replayed.
  await expect(
    financialWrite(session.id, "deposit", key, payload, randomUUID()),
  ).rejects.toMatchObject({ status: 401 });
}, 30000);
afterAll(async () => {
  await state.db?.$disconnect();
  // Only the randomly generated test schema created by this process is removed.
  if (created && /^test_otp_[a-f0-9]{32}$/.test(schema))
    await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
  await admin.end();
  vi.unstubAllEnvs();
});
it("persists failed attempts, preserves attempts on resend, consumes once and rolls back failed effects", async () => {
  const db = state.db!;
  const user = await db.user.create({
    data: {
      id: randomUUID(),
      emailNormalized: "otp@example.test",
      name: "Synthetic Applicant",
      passwordHash: "synthetic-unused-hash",
      status: "unverified",
    },
  });
  let code = "";
  const mailer = async (_email: string, value: string) => {
    code = value;
  };
  let flow = await startChallenge(
    user.id,
    user.emailNormalized,
    "registration",
    "synthetic-ip",
    mailer,
  );
  const wrong = code === "000000" ? "111111" : "000000";
  await expect(
    consumeChallenge(
      flow,
      wrong,
      ["registration"],
      "synthetic-ip",
      async () => "unused",
    ),
  ).rejects.toThrow();
  expect(
    (
      await db.otpChallenge.findUniqueOrThrow({
        where: { id: flow.split(".")[0] },
      })
    ).attempts,
  ).toBe(1);
  await expect(
    resendChallenge(flow, "synthetic-ip", mailer),
  ).rejects.toMatchObject({ status: 429 });
  await db.otpChallenge.update({
    where: { id: flow.split(".")[0] },
    data: { lastSentAt: new Date(Date.now() - 61000) },
  });
  await db.rateLimitBucket.updateMany({
    where: { key: { startsWith: "otp-cooldown:" } },
    data: { expiresAt: new Date(Date.now() - 1000) },
  });
  const oldFlow = flow;
  flow = await resendChallenge(flow, "synthetic-ip", mailer);
  await expect(
    consumeChallenge(
      oldFlow,
      code,
      ["registration"],
      "synthetic-ip",
      async () => "unused",
    ),
  ).rejects.toThrow();
  expect(
    (
      await db.otpChallenge.findUniqueOrThrow({
        where: { id: flow.split(".")[0] },
      })
    ).attempts,
  ).toBe(1);
  await expect(
    consumeChallenge(flow, code, ["registration"], "synthetic-ip", async () => {
      throw Error("injected effect failure");
    }),
  ).rejects.toThrow();
  expect(
    (
      await db.otpChallenge.findUniqueOrThrow({
        where: { id: flow.split(".")[0] },
      })
    ).consumedAt,
  ).toBeNull();
  const outcomes = await Promise.allSettled(
    [1, 2].map(() =>
      consumeChallenge(
        flow,
        code,
        ["registration"],
        "synthetic-ip",
        async (tx) => {
          await tx.user.update({
            where: { id: user.id },
            data: { status: "pending", emailVerifiedAt: new Date() },
          });
          return true;
        },
      ),
    ),
  );
  expect(outcomes.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(outcomes.filter((r) => r.status === "rejected")).toHaveLength(1);
}, 30000);
it("does not permit verification after failed SMTP delivery", async () => {
  const db = state.db!;
  const user = await db.user.create({
    data: {
      id: randomUUID(),
      emailNormalized: "failed@example.test",
      name: "Synthetic Failure",
      passwordHash: "synthetic-unused-hash",
      status: "unverified",
    },
  });
  let code = "";
  const flow = await startChallenge(
    user.id,
    user.emailNormalized,
    "registration",
    "failure-ip",
    async (_email, value) => {
      code = value;
      throw Error("mock SMTP unavailable");
    },
  );
  expect(
    (
      await db.otpChallenge.findUniqueOrThrow({
        where: { id: flow.split(".")[0] },
      })
    ).deliveryState,
  ).toBe("failed");
  await expect(
    consumeChallenge(
      flow,
      code,
      ["registration"],
      "failure-ip",
      async () => true,
    ),
  ).rejects.toThrow();
});
it("rejects wrong purpose, expiry, fifth failure and a new challenge during exhaustion cooldown", async () => {
  const db = state.db!;
  const u = await db.user.create({
    data: {
      id: randomUUID(),
      emailNormalized: "limits@example.test",
      name: "Synthetic Limits",
      passwordHash: "unused",
      status: "unverified",
    },
  });
  let code = "";
  const flow = await startChallenge(
    u.id,
    u.emailNormalized,
    "registration",
    "limits-ip",
    async (_email, value) => {
      code = value;
    },
  );
  await expect(
    consumeChallenge(flow, code, ["recovery"], "limits-ip", async () => true),
  ).rejects.toThrow();
  const wrong = code === "000000" ? "111111" : "000000";
  for (let i = 0; i < 5; i++)
    await expect(
      consumeChallenge(
        flow,
        wrong,
        ["registration"],
        "limits-ip",
        async () => true,
      ),
    ).rejects.toThrow();
  const row = await db.otpChallenge.findUniqueOrThrow({
    where: { id: flow.split(".")[0] },
  });
  expect(row.attempts).toBe(5);
  expect(row.revokedAt).not.toBeNull();
  await expect(
    consumeChallenge(
      flow,
      code,
      ["registration"],
      "limits-ip",
      async () => true,
    ),
  ).rejects.toThrow();
  await db.rateLimitBucket.updateMany({
    where: { key: { startsWith: "otp-cooldown:" } },
    data: { expiresAt: new Date(0) },
  });
  await expect(
    startChallenge(
      u.id,
      u.emailNormalized,
      "registration",
      "limits-ip",
      async () => {},
    ),
  ).rejects.toMatchObject({ status: 429 });
  const dummy = await startChallenge(
    null,
    "unknown@example.test",
    "recovery",
    "dummy-ip",
    async () => {
      throw Error("Dummy flow must not send");
    },
  );
  await db.otpChallenge.update({
    where: { id: dummy.split(".")[0] },
    data: {
      createdAt: new Date(Date.now() - 600000),
      expiresAt: new Date(Date.now() - 1000),
    },
  });
  await expect(
    consumeChallenge(
      dummy,
      "000000",
      ["recovery"],
      "dummy-ip",
      async () => true,
    ),
  ).rejects.toThrow();
});
it("Module 12: admin OTP, approval, member access, suspension, restoration and recovery", async () => {
  const db = state.db!;
  const password = "SyntheticPassword123!";
  const group = await db.group.create({
    data: { id: randomUUID(), code: "TEST", name: "Synthetic Group" },
  });
  const adminMember = await db.member.create({
    data: {
      id: randomUUID(),
      rosterKey: "synthetic-admin",
      name: "Synthetic Admin",
      groupId: group.id,
    },
  });
  const member = await db.member.create({
    data: {
      id: randomUUID(),
      rosterKey: "synthetic-member",
      name: "Synthetic Member",
      groupId: group.id,
    },
  });
  await db.authorizedAdmin.create({
    data: {
      slot: 1,
      memberId: adminMember.id,
      emailNormalized: "admin@example.test",
    },
  });
  const adminUser = await db.user.create({
    data: {
      id: randomUUID(),
      emailNormalized: "admin@example.test",
      name: "Synthetic Admin",
      memberId: adminMember.id,
      status: "approved",
      passwordHash: await hashPassword(password),
    },
  });
  const initial = await login(
    { email: adminUser.emailNormalized, password },
    "admin-ip",
  );
  expect("flow" in initial).toBe(true);
  expect(await db.session.count({ where: { userId: adminUser.id } })).toBe(0);
  if (!("flow" in initial)) throw Error("Expected admin flow");
  const adminSession = await verifyOtp(
    initial.flow,
    state.mailbox.get(adminUser.emailNormalized)!,
    "admin-ip",
    randomUUID(),
  );
  expect((await authority(db, adminSession.sessionId, "admin")).isAdmin).toBe(
    true,
  );
  const flow = await register(
    { name: "Synthetic Applicant", email: "applicant@example.test", password },
    "member-ip",
  );
  const pending = await verifyOtp(
    flow,
    state.mailbox.get("applicant@example.test")!,
    "member-ip",
    randomUUID(),
  );
  await expect(
    authority(db, pending.sessionId, "member"),
  ).rejects.toMatchObject({ status: 403 });
  const applicant = await db.user.findUniqueOrThrow({
    where: { emailNormalized: "applicant@example.test" },
  });
  await reviewUser(
    adminSession.sessionId,
    applicant.id,
    "approve",
    { member_id: member.id, expected_version: applicant.version },
    randomUUID(),
  );
  await expect(
    reviewUser(
      adminSession.sessionId,
      applicant.id,
      "approve",
      { member_id: member.id, expected_version: applicant.version },
      randomUUID(),
    ),
  ).rejects.toMatchObject({ status: 409 });
  await expect(
    authority(db, pending.sessionId, "member"),
  ).rejects.toMatchObject({ status: 403 });
  const logged = await login(
    { email: applicant.emailNormalized, password },
    "member-ip",
  );
  if (!("session" in logged) || !logged.session)
    throw Error("Expected member session");
  await authority(db, logged.session.sessionId, "member");
  await expect(
    authority(db, logged.session.sessionId, "admin"),
  ).rejects.toMatchObject({ status: 403 });
  const sessionResult = logged.session;
  const csrf = generateCsrfToken(sessionResult.sessionId);
  const request = (path: string, method = "GET", payload?: unknown) =>
    new NextRequest(`http://localhost:3000/api/v1/${path}`, {
      method,
      headers: {
        cookie: `cfp_session=${sessionResult.token}; cfp_csrf=${csrf}`,
        origin: "http://localhost:3000",
        "content-type": "application/json",
        "x-csrf-token": csrf,
        "idempotency-key": randomUUID(),
      },
      ...(payload ? { body: JSON.stringify(payload) } : {}),
    });
  const dispatch = async (path: string, method = "GET", payload?: unknown) =>
    endpoint(request(path, method, payload), async (c) => {
      const response = (await authApi(c, path)) ?? (await financeApi(c, path));
      if (!response) throw Error("Missing endpoint");
      return response;
    });
  expect((await dispatch("finance/summary")).status).toBe(200);
  expect((await dispatch("admin/audit-events")).status).toBe(403);
  expect(
    (
      await dispatch("deposits", "POST", {
        member_id: member.id,
        amount: "1.00",
        payment_date: today(),
        description: "Forbidden member write",
      })
    ).status,
  ).toBe(403);
  const memberResponse = await dispatch(`members/${member.id}`);
  expect(await memberResponse.json()).not.toHaveProperty("email");
  expect(memberResponse.headers.get("cache-control")).toBe("no-store");
  let current = await db.user.findUniqueOrThrow({
    where: { id: applicant.id },
  });
  await reviewUser(
    adminSession.sessionId,
    applicant.id,
    "suspend",
    { reason: "Synthetic suspension", expected_version: current.version },
    randomUUID(),
  );
  await expect(
    authority(db, logged.session.sessionId, "member"),
  ).rejects.toMatchObject({ status: 401 });
  const recovery = await recover(applicant.emailNormalized, "recovery-ip");
  await resetPassword(
    recovery,
    state.mailbox.get(applicant.emailNormalized)!,
    "SyntheticReplacement123!",
    "recovery-ip",
    randomUUID(),
  );
  current = await db.user.findUniqueOrThrow({ where: { id: applicant.id } });
  expect(current.status).toBe("suspended");
  await reviewUser(
    adminSession.sessionId,
    applicant.id,
    "restore",
    { reason: "Synthetic restoration", expected_version: current.version },
    randomUUID(),
  );
  await expect(
    authority(db, logged.session.sessionId, "member"),
  ).rejects.toMatchObject({ status: 401 });
  const adminCurrent = await db.user.findUniqueOrThrow({
    where: { id: adminUser.id },
  });
  await expect(
    reviewUser(
      adminSession.sessionId,
      adminUser.id,
      "suspend",
      { reason: "Must remain gated", expected_version: adminCurrent.version },
      randomUUID(),
    ),
  ).rejects.toMatchObject({ code: "POLICY_UNRESOLVED" });
}, 30000);
