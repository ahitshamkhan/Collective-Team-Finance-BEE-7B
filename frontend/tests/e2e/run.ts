import "dotenv/config";
import { randomBytes } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { spawn, spawnSync } from "node:child_process";
import { Client } from "pg";
import argon2 from "argon2";

async function main() {
  const name = `cfp_e2e_${randomBytes(10).toString("hex")}`;
  const source =
    process.env.TEST_DATABASE_URL ??
    process.env.DIRECT_URL ??
    process.env.DATABASE_URL;
  if (!source)
    throw Error("A PostgreSQL test provisioning connection is required");
  const url = new URL(source);
  url.pathname = `/${name}`;
  const admin = new Client({ connectionString: source });
  const temp = mkdtempSync(join(tmpdir(), "cfp-e2e-"));
  const mailbox = join(temp, "mail.jsonl");
  writeFileSync(mailbox, "");
  const env = {
    ...process.env,
    APP_ENV: "test",
    DATABASE_URL: url.toString(),
    PUBLIC_ORIGIN: "http://localhost:3100",
    COOKIE_SECURE: "false",
    JWT_SECRET: randomBytes(32).toString("hex"),
    OTP_HMAC_KEY: randomBytes(32).toString("hex"),
    CSRF_HMAC_KEY: randomBytes(32).toString("hex"),
    RATE_LIMIT_HMAC_KEY: randomBytes(32).toString("hex"),
    SMTP_HOST: "smtp.gmail.com",
    SMTP_PORT: "587",
    SMTP_USERNAME: "sender@example.test",
    SMTP_FROM: "sender@example.test",
    SMTP_APP_PASSWORD: "synthetic-unused",
    PORTAL_TEST_MAILBOX: mailbox,
  };
  let server: ReturnType<typeof spawn> | undefined;
  let created = false;
  await admin.connect();
  try {
    await admin.query(`CREATE DATABASE "${name}"`);
    created = true;
    const db = new Client({ connectionString: url.toString() });
    await db.connect();
    try {
      for (const migration of [
        "20261126195807_init",
        "20261126200132_fix_check_constraint_null_guards",
      ])
        await db.query(
          readFileSync(`prisma/migrations/${migration}/migration.sql`, "utf8"),
        );
      const { randomUUID } = await import("node:crypto");
      const groups = Array.from({ length: 10 }, () => randomUUID());
      for (let i = 0; i < 10; i++)
        await db.query("INSERT INTO groups(id,code,name) VALUES($1,$2,$3)", [
          groups[i],
          `G${i + 1}`,
          `Synthetic Group ${i + 1}`,
        ]);
      const members = Array.from({ length: 26 }, () => randomUUID());
      for (let i = 0; i < 26; i++)
        await db.query(
          "INSERT INTO members(id,roster_key,name,group_id) VALUES($1,$2,$3,$4)",
          [
            members[i],
            `synthetic-${i}`,
            `Synthetic Member ${i + 1}`,
            groups[i % 10],
          ],
        );
      const hash = await argon2.hash("SyntheticPassword123!", {
        type: argon2.argon2id,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 4,
      });
      for (let i = 0; i < 3; i++) {
        const email = `admin${i + 1}@example.test`;
        await db.query(
          "INSERT INTO authorized_admins(slot,member_id,email_normalized) VALUES($1,$2,$3)",
          [i + 1, members[i], email],
        );
        await db.query(
          "INSERT INTO users(id,email_normalized,name,password_hash,member_id,status) VALUES($1,$2,$3,$4,$5,'approved')",
          [randomUUID(), email, `Synthetic Admin ${i + 1}`, hash, members[i]],
        );
      }
    } finally {
      await db.end();
    }
    server = spawn(
      process.execPath,
      [
        "node_modules/next/dist/bin/next",
        ...(process.argv.includes("--production")
          ? ["start"]
          : ["dev", "--webpack"]),
        "--port",
        "3100",
      ],
      {
        env: {
          ...env,
          NODE_OPTIONS: `--import=${pathToFileURL(resolve("tests/e2e/mock-mail.mjs")).href}`,
        },
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    // Do not mistake an unrelated server already on this port for our child.
    let startup = "";
    server.stdout?.on("data", (data) => {
      startup = (startup + data.toString()).slice(-4000);
    });
    let errors = "";
    server.stderr?.on("data", (data) => {
      errors = (errors + data.toString()).slice(-4000);
    });
    let ready = false;
    for (let i = 0; i < 120; i++) {
      if (server.exitCode !== null)
        throw Error(`Test server stopped: ${errors}`);
      try {
        if (
          startup.includes("Ready in") &&
          (
            await fetch("http://localhost:3100/api/v1/health/live", {
              signal: AbortSignal.timeout(3000),
            })
          ).ok
        ) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 1000));
    }
    if (!ready) throw Error("Test server did not become ready");
    const args = process.argv.includes("--ui")
      ? ["test", "--config", "playwright.config.ts"]
      : ["test", "--config", "playwright.integration.config.ts"];
    const separator = process.argv.indexOf("--");
    if (separator >= 0) args.push(...process.argv.slice(separator + 1));
    const test = spawn(
      process.execPath,
      ["node_modules/@playwright/test/cli.js", ...args],
      {
        env: { ...env, PORTAL_TEST_URL: "http://localhost:3100" },
        stdio: "inherit",
        windowsHide: true,
      },
    );
    process.exitCode = await new Promise<number>((resolve) =>
      test.on("exit", (code) => resolve(code ?? 1)),
    );
    if (process.exitCode)
      console.error(errors.replaceAll(url.toString(), "[test database]"));
  } finally {
    if (server?.pid) {
      if (process.platform === "win32")
        spawnSync("taskkill", ["/pid", String(server.pid), "/T", "/F"], {
          windowsHide: true,
          stdio: "ignore",
        });
      else server.kill("SIGTERM");
    }
    if (created && /^cfp_e2e_[a-f0-9]{20}$/.test(name))
      await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
    await admin.end();
  }
}
main().catch(() => {
  console.error(
    "Isolated browser verification failed. Check test database permissions and local server availability.",
  );
  process.exitCode = 1;
});
