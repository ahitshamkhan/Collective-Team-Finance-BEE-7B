import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

async function code(email: string) {
  let value = "";
  await expect
    .poll(() => {
      const messages: { to: string; text: string }[] = readFileSync(
        process.env.PORTAL_TEST_MAILBOX!,
        "utf8",
      )
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line));
      value =
        messages
          .filter((m) => m.to === email)
          .at(-1)
          ?.text.match(/\b\d{6}\b/)?.[0] ?? "";
      return value;
    })
    .toMatch(/^\d{6}$/);
  return value;
}
async function login(
  page: Page,
  email: string,
  password = "SyntheticPassword123!",
) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}
// Covers AC-02 through AC-13: real identity, finance, permissions and lifecycle.
test("real member and administrator workflow with mock SMTP", async ({
  browser,
}) => {
  test.setTimeout(240000);
  const memberContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const adminContext = await browser.newContext();
  const member = await memberContext.newPage();
  const admin = await adminContext.newPage();
  try {
    await member.goto("/register");
    await member.getByLabel("Full name").fill("Synthetic Applicant");
    await member.getByLabel("Email address").fill("member@example.test");
    await member
      .getByLabel("Password", { exact: true })
      .fill("SyntheticPassword123!");
    await member.getByLabel("Confirm password").fill("SyntheticPassword123!");
    await member
      .getByRole("button", { name: "Request account", exact: true })
      .click();
    await expect(member).toHaveURL(/\/verify$/);
    await member
      .getByLabel("Verification code")
      .fill(await code("member@example.test"));
    await member.getByRole("button", { name: "Verify code" }).click();
    await expect(member).toHaveURL(/\/pending$/);
    expect((await member.request.get("/api/v1/finance/summary")).status()).toBe(
      403,
    );

    await login(admin, "admin1@example.test");
    await expect(admin).toHaveURL(/\/verify$/);
    expect(
      (await adminContext.cookies()).some(
        (cookie) => cookie.name === "cfp_session",
      ),
    ).toBe(false);
    await admin
      .getByLabel("Verification code")
      .fill(await code("admin1@example.test"));
    await admin.getByRole("button", { name: "Verify code" }).click();
    await expect(admin).toHaveURL(/\/overview$/);
    await admin.goto("/admin/approvals");
    await admin.getByRole("button", { name: "Review & approve" }).click();
    await admin
      .getByLabel("Roster member")
      .selectOption({ label: "Synthetic Member 4" });
    await admin
      .getByRole("button", { name: "Approve registration", exact: true })
      .click();
    await expect(admin.getByRole("status")).toContainText("Changes saved");
    await member
      .getByRole("button", { name: "Refresh account status" })
      .click();
    await expect(
      member.getByText("Your account is approved.", { exact: false }),
    ).toBeVisible();
    await member.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(member).toHaveURL(/\/login$/);
    await login(member, "member@example.test");
    await expect(member).toHaveURL(/\/overview$/);
    await expect(
      member.getByRole("heading", { name: "Finance overview" }),
    ).toBeVisible();
    expect(
      await member.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(
      (await member.request.get("/api/v1/admin/audit-events")).status(),
    ).toBe(403);

    await admin.goto("/admin/deposits");
    await admin
      .getByLabel("Depositing member", { exact: true })
      .selectOption({ label: "Synthetic Member 4" });
    await admin.getByLabel("Amount (PKR)", { exact: true }).fill("125.25");
    await admin
      .getByLabel("Description", { exact: true })
      .fill("Synthetic browser contribution");
    await admin
      .getByRole("button", { name: "Record deposit", exact: true })
      .click();
    await expect(admin.getByRole("status")).toContainText(
      "Transaction recorded",
    );
    await member.reload();
    await expect(member.locator("main:visible")).toContainText("125.25");
    await member.goto("/members");
    await member
      .getByRole("link", { name: "Synthetic Member 4", exact: true })
      .click();
    await expect(
      member.getByRole("heading", { name: "Synthetic Member 4", exact: true }),
    ).toBeVisible();
    await expect(member.locator("main:visible")).toContainText("125.25");
    await member
      .getByRole("link", { name: "Synthetic Group 4", exact: true })
      .first()
      .click();
    await expect(
      member.getByRole("heading", { name: "Synthetic Group 4", exact: true }),
    ).toBeVisible();
    await admin.goto("/ledger");
    await admin.getByRole("button", { name: "Correct", exact: true }).click();
    await admin
      .getByLabel("Reason", { exact: false })
      .fill("Synthetic browser correction");
    await admin
      .getByRole("button", { name: "Confirm void", exact: true })
      .click();
    await expect(
      admin.getByRole("table").getByText("Voided", { exact: true }),
    ).toBeVisible();
    await admin.goto("/admin/audit");
    await expect(admin.locator("main:visible")).toContainText(
      "transaction.void",
    );
    await admin.goto("/admin/expenses");
    await admin.getByLabel("Expense title").fill("Synthetic guarded expense");
    await admin.getByLabel("Expense attribution").selectOption("collective");
    await admin.getByLabel("Amount (PKR)", { exact: true }).fill("1.00");
    await admin
      .getByLabel("Description", { exact: true })
      .fill("Synthetic policy check");
    const guarded = admin.waitForResponse(
      (response) =>
        response.url().endsWith("/api/v1/expenses") &&
        response.request().method() === "POST",
    );
    await admin
      .getByRole("button", { name: "Record expense", exact: true })
      .click();
    const guardedResponse = await guarded;
    expect(guardedResponse.status()).toBe(409);
    expect((await guardedResponse.json()).error.code).toBe(
      "INSUFFICIENT_FUNDS",
    );
    await expect(
      admin.locator("main:visible").getByRole("alert"),
    ).toContainText("negative");
    await member.goto("/overview");
    await expect(member.locator("main:visible")).toContainText("0.00");

    await member.goto("/account");
    await member
      .getByRole("button", { name: "Sign out of all sessions" })
      .click();
    await expect(member).toHaveURL(/\/login$/);
    await member.goto("/forgot-password");
    await member.getByLabel("Email address").fill("member@example.test");
    await member.getByRole("button", { name: "Request recovery code" }).click();
    await expect(member).toHaveURL(/\/reset-password$/);
    await member
      .getByLabel("Verification code")
      .fill(await code("member@example.test"));
    await member
      .getByLabel("New password", { exact: true })
      .fill("SyntheticReplacement123!");
    await member
      .getByLabel("Confirm password")
      .fill("SyntheticReplacement123!");
    await member
      .getByRole("button", { name: "Reset password", exact: true })
      .click();
    await expect(member.getByRole("status")).toContainText(
      "password has been reset",
    );
    await login(member, "member@example.test", "SyntheticReplacement123!");
    await expect(member).toHaveURL(/\/overview$/);
    await member.goto("/admin");
    await expect(
      member.locator("main:visible").getByRole("alert"),
    ).toContainText("administrator access");
    await member.goto("/account");
    await member
      .getByLabel("Current password", { exact: true })
      .fill("SyntheticReplacement123!");
    await member
      .getByLabel("New password", { exact: true })
      .fill("SyntheticChanged123!");
    await member
      .getByLabel("Confirm new password")
      .fill("SyntheticChanged123!");
    await member.getByRole("button", { name: "Update password" }).click();
    await expect(member).toHaveURL(/\/login$/);
    await login(member, "member@example.test", "SyntheticChanged123!");
    await expect(member).toHaveURL(/\/overview$/);

    await admin.goto("/admin/approvals");
    await admin.getByLabel("Account status").selectOption("approved");
    const applicant = admin
      .getByRole("row")
      .filter({ hasText: "member@example.test" });
    await applicant
      .getByRole("button", { name: "Suspend", exact: true })
      .click();
    await admin
      .getByLabel("Reason", { exact: true })
      .fill("Synthetic suspension check");
    await admin
      .getByRole("button", { name: "Suspend account", exact: true })
      .click();
    await expect(admin.getByRole("dialog")).toHaveCount(0);
    await expect(applicant).toHaveCount(0);
    await member.reload();
    await expect(member).toHaveURL(/\/login$/);
    await expect(member.getByText("125.25", { exact: false })).toHaveCount(0);
    await admin.getByLabel("Account status").selectOption("suspended");
    await applicant
      .getByRole("button", { name: "Restore", exact: true })
      .click();
    await admin
      .getByLabel("Reason", { exact: true })
      .fill("Synthetic restoration check");
    await admin
      .getByRole("button", { name: "Restore account", exact: true })
      .click();
    await expect(admin.getByRole("dialog")).toHaveCount(0);
    await expect(applicant).toHaveCount(0);
    await login(member, "member@example.test", "SyntheticChanged123!");
    await expect(member).toHaveURL(/\/overview$/);
    await admin.goto("/admin/audit");
    await expect(admin.getByRole("table")).toBeVisible();
    await admin.screenshot({
      path: "test-results/module14-admin.png",
      fullPage: true,
    });
  } finally {
    await memberContext.close();
    await adminContext.close();
  }
});

// Covers AC-05, AC-07, AC-10, AC-12 and AC-13.
test("administrator rejects an applicant and persists permitted roster edits", async ({
  browser,
}) => {
  const applicantContext = await browser.newContext();
  const adminContext = await browser.newContext();
  const applicant = await applicantContext.newPage();
  const admin = await adminContext.newPage();
  try {
    await applicant.goto("/register");
    await applicant
      .getByLabel("Full name")
      .fill("Synthetic Rejected Applicant");
    await applicant.getByLabel("Email address").fill("rejected@example.test");
    await applicant
      .getByLabel("Password", { exact: true })
      .fill("SyntheticPassword123!");
    await applicant
      .getByLabel("Confirm password")
      .fill("SyntheticPassword123!");
    await applicant
      .getByRole("button", { name: "Request account", exact: true })
      .click();
    await expect(applicant).toHaveURL(/\/verify$/);
    await applicant
      .getByLabel("Verification code")
      .fill(await code("rejected@example.test"));
    await applicant.getByRole("button", { name: "Verify code" }).click();
    await expect(applicant).toHaveURL(/\/pending$/);
    await login(admin, "admin2@example.test");
    await expect(admin).toHaveURL(/\/verify$/);
    await admin
      .getByLabel("Verification code")
      .fill(await code("admin2@example.test"));
    await admin.getByRole("button", { name: "Verify code" }).click();
    await expect(admin).toHaveURL(/\/overview$/);
    await admin.goto("/admin/approvals");
    await admin
      .getByRole("row")
      .filter({ hasText: "rejected@example.test" })
      .getByRole("button", { name: "Reject", exact: true })
      .click();
    await admin
      .getByLabel("Reason", { exact: true })
      .fill("Synthetic rejection check");
    await admin
      .getByRole("button", { name: "Reject registration", exact: true })
      .click();
    await expect(admin.getByRole("dialog")).toHaveCount(0);
    await expect(admin.getByRole("status")).toContainText("Changes saved");
    await applicant
      .getByRole("button", { name: "Refresh account status" })
      .click();
    await expect(applicant.locator("main")).toContainText("rejected");
    expect((await applicant.request.get("/api/v1/members")).status()).toBe(403);

    await admin.goto("/admin/groups");
    await admin
      .getByRole("row")
      .filter({ hasText: "Synthetic Group 10" })
      .getByRole("button", { name: "Edit group" })
      .click();
    await admin
      .getByLabel("Name", { exact: true })
      .fill("Synthetic Renamed Group");
    await admin
      .getByRole("dialog")
      .getByRole("button", { name: "Edit group", exact: true })
      .click();
    await expect(admin.getByRole("dialog")).toHaveCount(0);
    await admin.reload();
    await expect(admin.getByRole("table")).toContainText(
      "Synthetic Renamed Group",
    );
    await admin.goto("/admin/members");
    await admin
      .getByRole("row")
      .filter({ hasText: "Synthetic Member 26" })
      .getByRole("button", { name: "Edit member" })
      .click();
    await admin
      .getByLabel("Name", { exact: true })
      .fill("Synthetic Renamed Member");
    await admin
      .getByRole("dialog")
      .getByRole("button", { name: "Edit member", exact: true })
      .click();
    await expect(admin.getByRole("dialog")).toHaveCount(0);
    await admin.reload();
    await expect(admin.getByRole("table")).toContainText(
      "Synthetic Renamed Member",
    );
    await admin.goto("/admin/audit");
    await expect(admin.getByRole("table")).toContainText("group.update");
    await expect(admin.getByRole("table")).toContainText("member.update");
  } finally {
    await applicantContext.close();
    await adminContext.close();
  }
});
