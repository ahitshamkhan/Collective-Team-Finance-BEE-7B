import { test, expect, type Page } from "@playwright/test";
import { fixtureData, fixtureProfile } from "../../src/dev/fixtures";
const production = process.env.PORTAL_TEST_PRODUCTION === "1";
test.describe("Development presentation", () => {
  test.skip(
    production,
    "Development previews are not available in production.",
  );
  test("all requested financial surfaces render at desktop, tablet and mobile widths", async ({
    page,
  }) => {
    test.setTimeout(240000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const routes = [
      "overview",
      "members",
      `members/${fixtureData.members[0].id}`,
      "groups",
      `groups/${fixtureData.groups[0].id}`,
      "ledger",
      "deposits",
      "expenses",
      "account",
      "admin",
      "admin/approvals",
      "admin/members",
      "admin/groups",
      "admin/deposits",
      "admin/expenses",
      "admin/audit",
    ];
    for (const width of [1440, 768, 390]) {
      await page.setViewportSize({ width, height: 900 });
      for (const route of routes) {
        await page.goto(`/dev/preview/${route}`, {
          waitUntil: "domcontentloaded",
        });
        await expect(
          page.getByText("Development preview.", { exact: true }),
        ).toBeVisible();
        await expect(page.locator("main h1")).toBeVisible();
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
      }
    }
    expect(errors).toEqual([]);
  });
  test("member views hide financial writes and reject admin preview paths", async ({
    page,
  }) => {
    await page.goto("/dev/preview/ledger?audience=member", {
      waitUntil: "domcontentloaded",
    });
    await expect(
      page.getByRole("heading", { name: "Transaction ledger", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Correct", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("navigation", { name: "Administration" }),
    ).toHaveCount(0);
    await page.goto("/dev/preview/admin?audience=member", {
      waitUntil: "domcontentloaded",
    });
    await expect(
      page.getByText("Member previews cannot open administrator screens."),
    ).toBeVisible();
  });
  test("filters, empty states and exact totals are meaningful", async ({
    page,
  }) => {
    await page.goto("/dev/preview/overview", { waitUntil: "domcontentloaded" });
    await expect(
      page.getByText("PKR 96,500.00", { exact: true }),
    ).toBeVisible();
    await page.goto("/dev/preview/ledger", { waitUntil: "domcontentloaded" });
    await page.getByLabel("Status", { exact: true }).selectOption("voided");
    await expect(page.locator("tbody tr")).toHaveCount(1);
    await page.getByRole("button", { name: "Details", exact: true }).click();
    await expect(page.getByRole("dialog")).toContainText(
      "Sample entry corrected",
    );
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", { name: "Details", exact: true }),
    ).toBeFocused();
    await page.getByLabel("Search records").fill("not a real record");
    await expect(
      page.getByText("No records found", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(page.locator("tbody tr")).toHaveCount(9);
  });
  test("mobile navigation is keyboard accessible and reaches admin pages", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/dev/preview/overview", { waitUntil: "domcontentloaded" });
    const menu = page.getByRole("button", { name: "Open navigation" });
    await menu.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    for (let i = 0; i < 18; i++) {
      await page.keyboard.press("Tab");
      expect(
        await dialog.evaluate((el) => el.contains(document.activeElement)),
      ).toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect(menu).toBeFocused();
    await menu.click();
    await dialog
      .getByRole("link", { name: "Audit history", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Audit history", exact: true }),
    ).toBeVisible();
    await expect(dialog).not.toBeVisible();
  });
  test("deposit and correction previews cannot persist changes", async ({
    page,
  }) => {
    const writes: string[] = [];
    page.on("request", (r) => {
      if (r.method() !== "GET" && r.url().includes("/api/v1/"))
        writes.push(r.url());
    });
    await page.goto("/dev/preview/admin/deposits", {
      waitUntil: "domcontentloaded",
    });
    await page
      .getByLabel("Depositing member", { exact: true })
      .selectOption(fixtureData.members[0].id);
    await page.getByLabel("Amount (PKR)", { exact: true }).fill("1250.25");
    await page
      .getByLabel("Description", { exact: true })
      .fill("Synthetic verified deposit");
    await page
      .getByRole("button", { name: "Record deposit", exact: true })
      .click();
    await expect(page.locator("main").getByRole("alert")).toContainText(
      "No transaction was saved",
    );
    await page
      .getByRole("button", { name: "Correct", exact: true })
      .first()
      .click();
    await page
      .getByLabel("Reason for correction")
      .fill("Synthetic review correction");
    await page.getByRole("button", { name: "Confirm void" }).click();
    await expect(page.getByRole("dialog")).toContainText(
      "original record has not been changed",
    );
    expect(writes).toEqual([]);
  });
  test("approval, roster editing, expense form and audit details work as previews", async ({
    page,
  }) => {
    await page.goto("/dev/preview/admin/approvals", {
      waitUntil: "domcontentloaded",
    });
    await page.getByRole("button", { name: "Review & approve" }).click();
    await page
      .getByLabel("Roster member", { exact: true })
      .selectOption(fixtureData.available[0].id);
    await page
      .getByRole("button", { name: "Approve registration", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toContainText(
      "No account or roster record was changed",
    );
    await page.goto("/dev/preview/admin/groups", {
      waitUntil: "domcontentloaded",
    });
    await page
      .getByRole("button", { name: "Edit group", exact: true })
      .first()
      .click();
    await page
      .getByLabel("Name", { exact: true })
      .fill("Synthetic renamed group");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Edit group", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toContainText(
      "No account or roster record was changed",
    );
    await page.goto("/dev/preview/admin/expenses", {
      waitUntil: "domcontentloaded",
    });
    await page.getByLabel("Expense attribution").selectOption("collective");
    await expect(page.getByLabel("Relevant group")).toHaveCount(0);
    await expect(page.getByLabel("Associated member (optional)")).toBeVisible();
    await page.goto("/dev/preview/admin/audit", {
      waitUntil: "domcontentloaded",
    });
    await page.getByRole("button", { name: "Inspect event" }).first().click();
    await expect(
      page
        .getByRole("dialog")
        .getByRole("heading", { name: "After", exact: true }),
    ).toBeVisible();
  });
});
test("public auth pages have labelled forms and never assume sign in success", async ({
  page,
}) => {
  test.setTimeout(120000);
  const failures: string[] = [];
  page.on("pageerror", (e) => failures.push(e.message));
  for (const route of [
    "login",
    "register",
    "verify",
    "pending",
    "forgot-password",
    "reset-password",
  ]) {
    await page.goto(`/${route}`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("h2").first()).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.route("**/api/v1/**", (r) =>
    r.fulfill({
      status: 503,
      json: {
        error: { code: "UNAVAILABLE", message: "Secure service unavailable" },
      },
    }),
  );
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email address").fill("sample@example.invalid");
  await page.getByLabel("Password", { exact: true }).fill("synthetic-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator("main").getByRole("alert")).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
  expect(failures).toEqual([]);
});
async function serveMember(page: Page) {
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const responses: Record<string, unknown> = {
      "/api/v1/auth/me": { ...fixtureProfile, role: "member" },
      "/api/v1/finance/summary": fixtureData.summary,
      "/api/v1/members": {
        items: fixtureData.members,
        total: 26,
        page: 1,
        page_size: 100,
      },
      "/api/v1/groups": fixtureData.groups,
      "/api/v1/transactions": fixtureData.transactions,
    };
    const json = responses[path];
    await route.fulfill({
      status: json ? 200 : 403,
      json: json || { error: { code: "FORBIDDEN", message: "Not allowed" } },
    });
  });
}
test("real route uses session projection and clears open private details after revocation", async ({
  page,
}) => {
  await serveMember(page);
  await page.goto("/ledger", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: "Transaction ledger", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Correct", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Details", exact: true })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.route("**/api/v1/auth/me", (r) =>
    r.fulfill({
      status: 401,
      json: { error: { code: "SESSION_EXPIRED", message: "Sign in again" } },
    }),
  );
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByText("Sample Administrator", { exact: true }),
  ).toHaveCount(0);
});
test("admin routes deny regular member projections before requesting financial data", async ({
  page,
}) => {
  await serveMember(page);
  const requested: string[] = [];
  page.on("request", (r) => requested.push(new URL(r.url()).pathname));
  await page.goto("/admin/deposits", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByText("You do not have administrator access to this page."),
  ).toBeVisible();
  expect(
    requested
      .filter((p) => p.startsWith("/api/v1/"))
      .every((p) => p === "/api/v1/auth/me"),
  ).toBe(true);
});
test("production excludes development fixtures and preview screens", async ({
  page,
  request,
}) => {
  test.skip(
    !production,
    "Run against next start with PORTAL_TEST_PRODUCTION=1.",
  );
  for (const path of ["/dev/preview/overview", "/dev/preview/admin/deposits"]) {
    const response = await request.get(path);
    expect(response.status()).toBe(404);
    expect(await response.text()).not.toContain("Sample Member 01");
  }
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByText("Open synthetic interface preview", { exact: false }),
  ).toHaveCount(0);
  await page.goto("/overview", { waitUntil: "domcontentloaded" });
  await expect(page.locator("main").getByRole("alert")).toBeVisible();
  await expect(page.getByText("PKR 96,500.00", { exact: true })).toHaveCount(0);
});
test("admin deposit requests retain an idempotency key across uncertain failures", async ({
  page,
}) => {
  await serveMember(page);
  await page.route("**/api/v1/auth/me", (r) =>
    r.fulfill({ json: fixtureProfile }),
  );
  await page.route("**/api/v1/auth/csrf", (r) =>
    r.fulfill({ json: { csrf_token: "synthetic-csrf-token" } }),
  );
  const requests: {
    key: string | undefined;
    body: unknown;
    csrf: string | undefined;
  }[] = [];
  await page.route("**/api/v1/deposits", async (r) => {
    requests.push({
      key: r.request().headers()["idempotency-key"],
      body: r.request().postDataJSON(),
      csrf: r.request().headers()["x-csrf-token"],
    });
    await r.fulfill(
      requests.length === 1
        ? {
            status: 503,
            json: {
              error: {
                code: "UNAVAILABLE",
                message: "Response could not be confirmed",
              },
            },
          }
        : {
            status: 201,
            json: fixtureData.transactions.items.find(
              (t) => t.kind === "deposit" && t.status === "active",
            ),
          },
    );
  });
  await page.goto("/admin/deposits", { waitUntil: "domcontentloaded" });
  await page
    .getByLabel("Depositing member", { exact: true })
    .selectOption(fixtureData.members[0].id);
  await page.getByLabel("Amount (PKR)", { exact: true }).fill("1250.25");
  await page
    .getByLabel("Description", { exact: true })
    .fill("Synthetic verified deposit");
  await page
    .getByRole("button", { name: "Record deposit", exact: true })
    .click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "Response could not be confirmed",
  );
  await page
    .getByRole("button", { name: "Record deposit", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Transaction recorded");
  expect(requests).toHaveLength(2);
  expect(requests[0].key).toMatch(/^[0-9a-f-]{36}$/);
  expect(requests[1].key).toBe(requests[0].key);
  expect(requests[1].body).toEqual(requests[0].body);
  expect(requests[0].csrf).toBe("synthetic-csrf-token");
  expect(requests[0].body).toEqual({
    member_id: fixtureData.members[0].id,
    amount: "1250.25",
    payment_date: expect.any(String),
    description: "Synthetic verified deposit",
  });
  await expect(page.getByLabel("Amount (PKR)", { exact: true })).toHaveValue(
    "",
  );
});
test("OTP navigation requires a real challenge response and respects its resend timer", async ({
  page,
}) => {
  await page.route("**/api/v1/auth/csrf", (r) =>
    r.fulfill({ json: { csrf_token: "synthetic-csrf-token" } }),
  );
  await page.route("**/api/v1/auth/login", (r) =>
    r.fulfill({
      status: 202,
      json: {
        next_step: "verify",
        expires_in_seconds: 300,
        resend_after_seconds: 60,
      },
    }),
  );
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email address").fill("sample@example.invalid");
  await page.getByLabel("Password", { exact: true }).fill("synthetic-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/verify$/);
  await expect(
    page.getByRole("button", { name: /Resend available/ }),
  ).toBeDisabled();
  await expect(page.getByLabel("Verification code")).toBeVisible();
});
