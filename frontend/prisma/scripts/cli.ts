/**
 * Collective Finance Portal — Roster and Admin Provisioning CLI
 *
 * Usage (from frontend/):
 *   npx tsx prisma/scripts/cli.ts roster validate --file <path>
 *   npx tsx prisma/scripts/cli.ts roster import --file <path> --operator <label> [--apply]
 *   npx tsx prisma/scripts/cli.ts admins provision --file <path> --operator <label> [--apply]
 *
 * Manifests are private JSON files that must NEVER be committed to Git.
 */

import "dotenv/config";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client.js";

// ─── Types ───────────────────────────────────────────────

interface GroupEntry {
  code: string;
  name: string;
}

interface MemberEntry {
  roster_key: string;
  name: string;
  group_code: string;
}

interface RosterManifest {
  groups: GroupEntry[];
  members: MemberEntry[];
}

interface AdminEntry {
  slot: number;
  email: string;
  member_roster_key: string;
}

interface AdminManifest {
  admins: AdminEntry[];
}

// ─── Helpers ─────────────────────────────────────────────

function fatal(msg: string): never {
  console.error(`ERROR: ${msg}`);
  process.exit(1);
}

function getArg(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : undefined;
}

function hasFlag(args: string[], flag: string): boolean {
  return args.includes(flag);
}

function createClient(urlEnvVar: string = "PROVISIONING_DATABASE_URL"): PrismaClient {
  const url = process.env[urlEnvVar] || process.env.DATABASE_URL;
  if (!url) fatal(`${urlEnvVar} or DATABASE_URL must be set`);

  const adapter = new PrismaPg({
    connectionString: url!,
    max: 2,
    connectionTimeoutMillis: 5000,
  });

  return new PrismaClient({ adapter });
}

// ─── Roster Validation ───────────────────────────────────

function validateRoster(manifest: RosterManifest): string[] {
  const errors: string[] = [];

  // Check counts
  if (!Array.isArray(manifest.groups)) {
    errors.push("'groups' must be an array");
    return errors;
  }
  if (!Array.isArray(manifest.members)) {
    errors.push("'members' must be an array");
    return errors;
  }
  if (manifest.groups.length !== 10) {
    errors.push(`Expected exactly 10 groups, found ${manifest.groups.length}`);
  }
  if (manifest.members.length !== 26) {
    errors.push(`Expected exactly 26 members, found ${manifest.members.length}`);
  }

  // Validate groups
  const groupCodes = new Set<string>();
  for (let i = 0; i < manifest.groups.length; i++) {
    const g = manifest.groups[i];
    if (!g.code || typeof g.code !== "string" || g.code.trim().length === 0) {
      errors.push(`Group at row ${i + 1}: missing or empty code`);
    } else if (groupCodes.has(g.code)) {
      errors.push(`Group at row ${i + 1}: duplicate code "${g.code}"`);
    } else {
      groupCodes.add(g.code);
    }
    if (!g.name || typeof g.name !== "string" || g.name.trim().length === 0) {
      errors.push(`Group at row ${i + 1}: missing or empty name`);
    }
  }

  // Validate members
  const rosterKeys = new Set<string>();
  for (let i = 0; i < manifest.members.length; i++) {
    const m = manifest.members[i];
    if (!m.roster_key || typeof m.roster_key !== "string" || m.roster_key.trim().length === 0) {
      errors.push(`Member at row ${i + 1}: missing or empty roster_key`);
    } else if (rosterKeys.has(m.roster_key)) {
      errors.push(`Member at row ${i + 1}: duplicate roster_key "${m.roster_key}"`);
    } else {
      rosterKeys.add(m.roster_key);
    }
    if (!m.name || typeof m.name !== "string" || m.name.trim().length === 0) {
      errors.push(`Member at row ${i + 1}: missing or empty name`);
    }
    if (!m.group_code || !groupCodes.has(m.group_code)) {
      errors.push(`Member at row ${i + 1}: invalid group_code "${m.group_code}"`);
    }
  }

  return errors;
}

function validateAdminManifest(
  manifest: AdminManifest,
  rosterKeys: Set<string>,
): string[] {
  const errors: string[] = [];

  if (!Array.isArray(manifest.admins)) {
    errors.push("'admins' must be an array");
    return errors;
  }
  if (manifest.admins.length !== 3) {
    errors.push(`Expected exactly 3 admin slots, found ${manifest.admins.length}`);
  }

  const slots = new Set<number>();
  const emails = new Set<string>();
  const keys = new Set<string>();

  for (let i = 0; i < manifest.admins.length; i++) {
    const a = manifest.admins[i];
    if (typeof a.slot !== "number" || a.slot < 1 || a.slot > 3) {
      errors.push(`Admin at row ${i + 1}: slot must be 1, 2, or 3`);
    } else if (slots.has(a.slot)) {
      errors.push(`Admin at row ${i + 1}: duplicate slot ${a.slot}`);
    } else {
      slots.add(a.slot);
    }

    const normalizedEmail = (a.email || "").trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      errors.push(`Admin at row ${i + 1}: invalid email`);
    } else if (emails.has(normalizedEmail)) {
      errors.push(`Admin at row ${i + 1}: duplicate email`);
    } else {
      emails.add(normalizedEmail);
    }

    if (!a.member_roster_key || !rosterKeys.has(a.member_roster_key)) {
      errors.push(`Admin at row ${i + 1}: invalid member_roster_key "${a.member_roster_key}"`);
    } else if (keys.has(a.member_roster_key)) {
      errors.push(`Admin at row ${i + 1}: duplicate member_roster_key`);
    } else {
      keys.add(a.member_roster_key);
    }
  }

  // Check exactly slots 1, 2, 3
  if (slots.size === 3 && !(slots.has(1) && slots.has(2) && slots.has(3))) {
    errors.push("Slots must be exactly 1, 2, and 3");
  }

  return errors;
}

// ─── Commands ────────────────────────────────────────────

async function rosterValidate(filePath: string): Promise<void> {
  const raw = readFileSync(resolve(filePath), "utf8");
  const manifest = JSON.parse(raw) as RosterManifest;
  const errors = validateRoster(manifest);

  if (errors.length > 0) {
    console.error("Validation failed:");
    errors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }

  console.log(
    `Validation passed: ${manifest.groups.length} groups, ${manifest.members.length} members`,
  );
}

async function rosterImport(
  filePath: string,
  operatorLabel: string,
  apply: boolean,
): Promise<void> {
  const raw = readFileSync(resolve(filePath), "utf8");
  const manifest = JSON.parse(raw) as RosterManifest;
  const errors = validateRoster(manifest);

  if (errors.length > 0) {
    console.error("Validation failed — aborting import:");
    errors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }

  if (!apply) {
    console.log("DRY RUN — no changes applied. Add --apply to execute.");
    console.log(
      `Would import: ${manifest.groups.length} groups, ${manifest.members.length} members`,
    );
    return;
  }

  const prisma = createClient();
  try {
    await prisma.$transaction(async (tx) => {
      // Acquire mutation guard
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(260010)`;

      // Check if roster already exists
      const existingGroups = await tx.group.count();
      const existingMembers = await tx.member.count();

      if (existingGroups > 0 || existingMembers > 0) {
        // Idempotency: verify existing data matches
        const groups = await tx.group.findMany({ orderBy: { code: "asc" } });
        const members = await tx.member.findMany({
          orderBy: { rosterKey: "asc" },
          include: { group: true },
        });

        if (groups.length !== 10 || members.length !== 26) {
          throw new Error(
            `Database has ${groups.length} groups and ${members.length} members — cannot safely re-import`,
          );
        }

        console.log("Roster already imported — no changes needed.");
        return;
      }

      // Build group code → ID map
      const groupMap = new Map<string, string>();
      for (const g of manifest.groups) {
        const id = randomUUID();
        groupMap.set(g.code, id);
        await tx.group.create({
          data: { id, code: g.code.trim(), name: g.name.trim() },
        });
      }

      // Insert members
      for (const m of manifest.members) {
        const groupId = groupMap.get(m.group_code);
        if (!groupId) throw new Error(`Group code ${m.group_code} not found`);

        await tx.member.create({
          data: {
            id: randomUUID(),
            rosterKey: m.roster_key.trim(),
            name: m.name.trim(),
            groupId,
          },
        });
      }

      // Audit event
      await tx.auditEvent.create({
        data: {
          id: randomUUID(),
          actorKind: "operator",
          actorLabel: operatorLabel,
          operation: "roster.import",
          entityType: "roster",
          requestId: randomUUID(),
          afterValues: {
            groups_count: manifest.groups.length,
            members_count: manifest.members.length,
          },
        },
      });
    });

    console.log(
      `Roster imported: ${manifest.groups.length} groups, ${manifest.members.length} members`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

async function adminsProvision(
  filePath: string,
  operatorLabel: string,
  apply: boolean,
): Promise<void> {
  const raw = readFileSync(resolve(filePath), "utf8");
  const manifest = JSON.parse(raw) as AdminManifest;

  // Need existing roster keys to validate
  const prisma = createClient();
  try {
    const members = await prisma.member.findMany({
      select: { rosterKey: true },
    });
    const rosterKeys = new Set(members.map((m) => m.rosterKey));

    if (rosterKeys.size !== 26) {
      fatal(`Expected 26 roster members, found ${rosterKeys.size}. Import roster first.`);
    }

    const errors = validateAdminManifest(manifest, rosterKeys);
    if (errors.length > 0) {
      console.error("Admin manifest validation failed:");
      errors.forEach((e) => console.error(`  - ${e}`));
      process.exit(1);
    }

    if (!apply) {
      console.log("DRY RUN — no changes applied. Add --apply to execute.");
      console.log(`Would provision ${manifest.admins.length} admin slots`);
      return;
    }

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(260010)`;

      // Check existing admins
      const existingAdmins = await tx.authorizedAdmin.count();
      if (existingAdmins === 3) {
        console.log("Admin slots already provisioned — no changes needed.");
        return;
      }
      if (existingAdmins > 0) {
        throw new Error(
          `Database has ${existingAdmins} admin slots — cannot safely re-provision`,
        );
      }

      for (const a of manifest.admins) {
        const member = await tx.member.findUnique({
          where: { rosterKey: a.member_roster_key },
        });
        if (!member) {
          throw new Error(`Member with roster_key "${a.member_roster_key}" not found`);
        }

        const normalizedEmail = a.email.trim().toLowerCase();

        await tx.authorizedAdmin.create({
          data: {
            slot: a.slot,
            memberId: member.id,
            emailNormalized: normalizedEmail,
          },
        });
      }

      await tx.auditEvent.create({
        data: {
          id: randomUUID(),
          actorKind: "operator",
          actorLabel: operatorLabel,
          operation: "admins.provision",
          entityType: "authorized_admin",
          requestId: randomUUID(),
          afterValues: { slots_provisioned: manifest.admins.length },
        },
      });
    });

    console.log(
      `Admin provisioning complete: ${manifest.admins.length} slots configured`,
    );
    console.log(
      "\nNOTE: Admin user accounts must be created separately via interactive password entry.",
    );
    console.log(
      "Each admin must complete email OTP verification on first login.",
    );
  } finally {
    await prisma.$disconnect();
  }
}

async function adminLifecycle(
  action: "suspend" | "restore",
  email: string,
  reason: string,
  operatorLabel: string,
  apply: boolean,
): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();
  const trimmedReason = reason.trim();
  const trimmedOperator = operatorLabel.trim();

  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    fatal("--email must be a valid email address");
  }
  if (trimmedReason.length < 5 || trimmedReason.length > 500) {
    fatal("--reason must be between 5 and 500 characters");
  }
  if (!trimmedOperator) {
    fatal("--operator must be a non-empty label");
  }

  if (!apply) {
    console.log("DRY RUN — no changes applied. Add --apply to execute.");
    console.log(`Would ${action} reserved administrator account: ${normalizedEmail}`);
    return;
  }

  const prisma = createClient();
  try {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(260010)`;

      const adminSlot = await tx.authorizedAdmin.findUnique({
        where: { emailNormalized: normalizedEmail },
      });
      if (!adminSlot) {
        throw new Error(`No authorized administrator slot found for ${normalizedEmail}`);
      }

      const user = await tx.user.findUnique({
        where: { emailNormalized: normalizedEmail },
      });
      if (!user || user.memberId !== adminSlot.memberId) {
        throw new Error(`No linked administrator user account found for ${normalizedEmail}`);
      }

      if (action === "suspend") {
        if (user.status === "suspended") {
          throw new Error("Administrator account is already suspended");
        }
        const activeAdmins = await tx.user.count({
          where: {
            status: "approved",
            member: { authorizedAdmin: { isNot: null } },
          },
        });
        if (activeAdmins <= 1) {
          throw new Error("Cannot suspend the last active authorized administrator");
        }

        const now = new Date();
        const updated = await tx.user.update({
          where: { id: user.id },
          data: {
            status: "suspended",
            statusBeforeSuspension: user.status,
            version: { increment: 1 },
          },
        });
        await tx.session.updateMany({
          where: { userId: user.id, revokedAt: null },
          data: { revokedAt: now },
        });
        await tx.otpChallenge.updateMany({
          where: { userId: user.id, consumedAt: null, revokedAt: null },
          data: { revokedAt: now },
        });
        await tx.auditEvent.create({
          data: {
            id: randomUUID(),
            actorKind: "operator",
            actorLabel: trimmedOperator,
            operation: "admin.suspend",
            entityType: "user",
            entityId: user.id,
            requestId: randomUUID(),
            beforeValues: { status: user.status },
            afterValues: { status: updated.status },
            reason: trimmedReason,
          },
        });
      } else {
        if (user.status !== "suspended" || !user.statusBeforeSuspension) {
          throw new Error("Administrator account is not suspended");
        }
        const updated = await tx.user.update({
          where: { id: user.id },
          data: {
            status: user.statusBeforeSuspension,
            statusBeforeSuspension: null,
            version: { increment: 1 },
          },
        });
        await tx.auditEvent.create({
          data: {
            id: randomUUID(),
            actorKind: "operator",
            actorLabel: trimmedOperator,
            operation: "admin.restore",
            entityType: "user",
            entityId: user.id,
            requestId: randomUUID(),
            beforeValues: { status: user.status },
            afterValues: { status: updated.status },
            reason: trimmedReason,
          },
        });
      }
    });

    console.log(`Administrator ${action} completed for ${normalizedEmail}`);
  } finally {
    await prisma.$disconnect();
  }
}

// ─── CLI Entry Point ─────────────────────────────────────

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];
  const subcommand = args[1];

  if (command === "roster" && subcommand === "validate") {
    const file = getArg(args, "--file");
    if (!file) fatal("--file is required");
    await rosterValidate(file!);
  } else if (command === "roster" && subcommand === "import") {
    const file = getArg(args, "--file");
    const operator = getArg(args, "--operator");
    if (!file) fatal("--file is required");
    if (!operator) fatal("--operator is required");
    await rosterImport(file!, operator!, hasFlag(args, "--apply"));
  } else if (command === "admins" && subcommand === "provision") {
    const file = getArg(args, "--file");
    const operator = getArg(args, "--operator");
    if (!file) fatal("--file is required");
    if (!operator) fatal("--operator is required");
    await adminsProvision(file!, operator!, hasFlag(args, "--apply"));
  } else if (
    command === "admins" &&
    (subcommand === "suspend" || subcommand === "restore")
  ) {
    const email = getArg(args, "--email");
    const reason = getArg(args, "--reason");
    const operator = getArg(args, "--operator");
    if (!email) fatal("--email is required");
    if (!reason) fatal("--reason is required");
    if (!operator) fatal("--operator is required");
    await adminLifecycle(
      subcommand,
      email!,
      reason!,
      operator!,
      hasFlag(args, "--apply"),
    );
  } else {
    console.log("Usage:");
    console.log("  npx tsx prisma/scripts/cli.ts roster validate --file <path>");
    console.log(
      "  npx tsx prisma/scripts/cli.ts roster import --file <path> --operator <label> [--apply]",
    );
    console.log(
      "  npx tsx prisma/scripts/cli.ts admins provision --file <path> --operator <label> [--apply]",
    );
    console.log(
      "  npx tsx prisma/scripts/cli.ts admins suspend --email <email> --reason <reason> --operator <label> [--apply]",
    );
    console.log(
      "  npx tsx prisma/scripts/cli.ts admins restore --email <email> --reason <reason> --operator <label> [--apply]",
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
