import { test, expect, type Page } from "@playwright/test";
import {
  fixtureData,
  fixtureProfile as expiredFixtureProfile,
} from "../../src/dev/fixtures";
const fixtureProfile = {
  ...expiredFixtureProfile,
  session_expires_at: new Date(Date.now() + 3600000).toISOString(),
};

test("detail filters show and retain the route context", async ({ page }) => {
  await setup(page);
  await page.goto(`/members/${fixtureData.members[0].id}`, {
    waitUntil: "domcontentloaded",
  });
  await expect(page.getByLabel("Member", { exact: true })).toHaveValue(
    fixtureData.members[0].id,
  );
  await expect(page.getByLabel("Member", { exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.getByLabel("Member", { exact: true })).toHaveValue(
    fixtureData.members[0].id,
  );
  await page.goto(`/groups/${fixtureData.groups[0].id}`, {
    waitUntil: "domcontentloaded",
  });
  await expect(
    page.getByLabel("Historical group", { exact: true }),
  ).toHaveValue(fixtureData.groups[0].id);
  await expect(
    page.getByLabel("Historical group", { exact: true }),
  ).toBeDisabled();
});

test("later CSRF rejection does not erase an uncertain financial request", async ({
  page,
}) => {
  await setup(page);
  const keys: string[] = [];
  await page.route("**/api/v1/deposits", async (r) => {
    keys.push(r.request().headers()["idempotency-key"]);
    await r.fulfill({
      status: 503,
      json: {
        error: { code: "UNCERTAIN", message: "Synthetic uncertain result" },
      },
    });
  });
  await fillDeposit(page);
  const submit = page.getByRole("button", {
    name: "Record deposit",
    exact: true,
  });
  await submit.click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "Synthetic uncertain result",
  );
  await page.route("**/api/v1/auth/csrf", (r) =>
    r.fulfill({
      status: 403,
      json: { error: { code: "CSRF_REJECTED", message: "CSRF rejected" } },
    }),
  );
  await submit.click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "secure service",
  );
  await page.unroute("**/api/v1/auth/csrf");
  await page.getByLabel("Amount (PKR)", { exact: true }).fill("101.00");
  await submit.click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "Restore its values",
  );
  expect(keys).toHaveLength(1);
  await page.getByLabel("Amount (PKR)", { exact: true }).fill("100.00");
  await submit.click();
  await expect.poll(() => keys.length).toBe(2);
  expect(keys[1]).toBe(keys[0]);
});
async function setup(page: Page) {
  await page.route("**/api/v1/**", async (r) => {
    const path = new URL(r.request().url()).pathname;
    const responses: Record<string, unknown> = {
      "/api/v1/auth/me": fixtureProfile,
      "/api/v1/auth/csrf": { csrf_token: "synthetic-csrf" },
      "/api/v1/finance/summary": fixtureData.summary,
      "/api/v1/members": {
        items: fixtureData.members,
        total: 26,
        page: 1,
        page_size: 100,
      },
      "/api/v1/groups": fixtureData.groups,
      [`/api/v1/members/${fixtureData.members[0].id}`]: fixtureData.members[0],
      [`/api/v1/groups/${fixtureData.groups[0].id}`]: {
        ...fixtureData.groups[0],
        members: fixtureData.members
          .filter((m) => m.current_group.id === fixtureData.groups[0].id)
          .map((m) => ({ id: m.id, name: m.name })),
      },
      "/api/v1/transactions": fixtureData.transactions,
    };
    await r.fulfill({
      status: responses[path] ? 200 : 404,
      json: responses[path] || {
        error: { code: "MISSING", message: "Not connected" },
      },
    });
  });
}
async function fillDeposit(page: Page) {
  await page.goto("/admin/deposits", { waitUntil: "domcontentloaded" });
  await page
    .getByLabel("Depositing member", { exact: true })
    .selectOption(fixtureData.members[0].id);
  await page.getByLabel("Amount (PKR)", { exact: true }).fill("100.00");
  await page
    .getByLabel("Description", { exact: true })
    .fill("Synthetic deposit verification");
}
test("a definitive validation rejection allows editing and a new request", async ({
  page,
}) => {
  await setup(page);
  const keys: string[] = [];
  await page.route("**/api/v1/deposits", async (r) => {
    keys.push(r.request().headers()["idempotency-key"]);
    await r.fulfill({
      status: 422,
      json: {
        error: {
          code: "VALIDATION_ERROR",
          message: "Synthetic validation rejection",
        },
      },
    });
  });
  await fillDeposit(page);
  await page
    .getByRole("button", { name: "Record deposit", exact: true })
    .click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "Synthetic validation rejection",
  );
  await page.getByLabel("Amount (PKR)", { exact: true }).fill("101.00");
  await page
    .getByRole("button", { name: "Record deposit", exact: true })
    .click();
  await expect.poll(() => keys.length).toBe(2);
  expect(keys[1]).not.toBe(keys[0]);
});
test("correction retry identity survives dismissal after an uncertain response", async ({
  page,
}) => {
  await setup(page);
  const keys: string[] = [];
  await page.route("**/api/v1/transactions/*/void", async (r) => {
    keys.push(r.request().headers()["idempotency-key"]);
    await r.fulfill({
      status: 503,
      json: {
        error: { code: "UNCERTAIN", message: "Synthetic uncertain result" },
      },
    });
  });
  await page.goto("/ledger", { waitUntil: "domcontentloaded" });
  await page
    .getByRole("button", { name: "Correct", exact: true })
    .first()
    .click();
  await page
    .getByLabel("Reason for correction")
    .fill("Synthetic correction reason");
  await page.getByRole("button", { name: "Confirm void" }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "Synthetic uncertain result",
  );
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page
    .getByRole("button", { name: "Correct", exact: true })
    .first()
    .click();
  await page
    .getByLabel("Reason for correction")
    .fill("Synthetic correction reason");
  await page.getByRole("button", { name: "Confirm void" }).click();
  await expect.poll(() => keys.length).toBe(2);
  expect(keys[1]).toBe(keys[0]);
});
test("CSRF session rejection clears private modal and redirects to login", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/ledger", { waitUntil: "domcontentloaded" });
  await page
    .getByRole("button", { name: "Correct", exact: true })
    .first()
    .click();
  await page.getByLabel("Reason for correction").fill("Synthetic reason");
  await page.route("**/api/v1/auth/csrf", (r) =>
    r.fulfill({
      status: 401,
      json: { error: { code: "EXPIRED", message: "Session expired" } },
    }),
  );
  await page.getByRole("button", { name: "Confirm void" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

// Covers AC-06 and AC-07 even when the user makes no further API request.
test("session expiry clears an idle private dialog and returns to login", async ({
  page,
}) => {
  await setup(page);
  await page.clock.install();
  const expires = new Date(Date.now() + 60000).toISOString();
  await page.route("**/api/v1/auth/me", (route) =>
    route.fulfill({ json: { ...fixtureProfile, session_expires_at: expires } }),
  );
  await page.goto("/ledger", { waitUntil: "domcontentloaded" });
  await page
    .getByRole("button", { name: "Correct", exact: true })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.clock.fastForward(61000);
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
test("financial forms reject whitespace descriptions and values above storage precision", async ({
  page,
}) => {
  await setup(page);
  let writes = 0;
  await page.route("**/api/v1/deposits", async (r) => {
    writes++;
    await r.fulfill({
      status: 422,
      json: { error: { code: "VALIDATION_ERROR", message: "Server rejected" } },
    });
  });
  await fillDeposit(page);
  await page.getByLabel("Description", { exact: true }).fill("   ");
  await page
    .getByRole("button", { name: "Record deposit", exact: true })
    .click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "description",
  );
  expect(writes).toBe(0);
  await page
    .getByLabel("Description", { exact: true })
    .fill("Synthetic description");
  await page
    .getByLabel("Amount (PKR)", { exact: true })
    .fill("1000000000000.00");
  await page
    .getByRole("button", { name: "Record deposit", exact: true })
    .click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "999,999,999,999.99",
  );
  expect(writes).toBe(0);
});
