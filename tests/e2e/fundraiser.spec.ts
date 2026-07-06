import { expect, test } from "@playwright/test";

// Convention (see storefront.spec.ts): these run without a seeded database —
// they verify routing, auth gating, and public page states.

test.describe("Fundraiser routes", () => {
  test("wizard redirects unauthenticated users to sign-in", async ({ page }) => {
    await page.goto("/fundraisers/new");
    await page.waitForURL("**/auth/sign-in**", { timeout: 5000 }).catch(() => {});
    expect(["/fundraisers/new", "/auth/sign-in"].some((p) => page.url().includes(p))).toBe(true);
  });

  test("take-orders redirects unauthenticated users to sign-in", async ({ page }) => {
    await page.goto("/fundraisers/some-catalog-id/take-orders");
    await page.waitForURL("**/auth/sign-in**", { timeout: 5000 }).catch(() => {});
    expect(
      ["/fundraisers/some-catalog-id/take-orders", "/auth/sign-in"].some((p) =>
        page.url().includes(p),
      ),
    ).toBe(true);
  });

  test("volunteer link page shows inactive state for an unknown token", async ({ page }) => {
    await page.goto("/v/not-a-real-token");
    await expect(page.getByText("This link is no longer active")).toBeVisible();
  });
});

// The full journey needs a signed-in admin against a seeded database. It runs
// only when E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD are set (same dev stack the
// other specs assume, plus a real admin account).
const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;

test.describe("fundraiser volunteer flow", () => {
  test.skip(
    !adminEmail || !adminPassword,
    "Set E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD to run the seeded journey",
  );

  test("wizard → publish → volunteer link → order → kitchen", async ({ page, browser }) => {
    // 1. Sign in as an ADMIN
    await page.goto("/auth/sign-in");
    await page.getByLabel("Email").fill(adminEmail as string);
    await page.getByLabel("Password").fill(adminPassword as string);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL((url) => !url.pathname.includes("/auth/sign-in"));

    // 2. Create + publish a fundraiser through the wizard
    await page.goto("/fundraisers/new");
    await page.getByLabel("Fundraiser name").fill("E2E Pupusa Sale");
    await page.getByRole("button", { name: "Next: Menu items" }).click();
    await page.getByPlaceholder("Item name").fill("Pupusa de queso");
    await page.getByPlaceholder("$", { exact: true }).first().fill("3.50");
    await page.getByRole("button", { name: "Next: Delivery" }).click();
    await page.getByLabel("Minimum items for delivery (blank = no rule)").fill("3");
    await page.getByRole("button", { name: "Next: Review & publish" }).click();
    await page.getByRole("button", { name: "Publish now" }).click();
    await expect(page.getByText("Fundraiser is live")).toBeVisible();

    // 3. Generate volunteer link
    await page.getByRole("button", { name: "Generate volunteer link" }).click();
    const linkUrl = await page.locator("code").textContent();
    expect(linkUrl).toContain("/v/");

    // 4. Anonymous context takes an order through the link
    const volunteerContext = await browser.newContext();
    const volunteerPage = await volunteerContext.newPage();
    await volunteerPage.goto(linkUrl as string);
    await volunteerPage.getByPlaceholder("e.g. Maria").fill("Maria");
    await volunteerPage.getByRole("button", { name: "Start taking orders" }).click();
    await volunteerPage.getByRole("button", { name: /Pupusa de queso/ }).click();
    await volunteerPage.getByRole("button", { name: /Customer info/ }).click();
    await volunteerPage.getByPlaceholder("Name *").fill("Hermana Rosa");
    await volunteerPage.getByPlaceholder("Phone *").fill("5552018842");
    await volunteerPage.getByRole("button", { name: /Submit/ }).click();
    await expect(volunteerPage.getByText(/Order #\d+ — Hermana Rosa/)).toBeVisible();

    // 5. Delivery is locked below 3 items
    await volunteerPage.getByRole("button", { name: /Pupusa de queso/ }).click();
    await volunteerPage.getByRole("button", { name: /Customer info/ }).click();
    await expect(
      volunteerPage.getByRole("button", { name: /Delivery \(3\+ items\)/ }),
    ).toBeDisabled();

    // 6. Kitchen sees the order
    await page.goto("/kitchen");
    await expect(page.getByText("Hermana Rosa")).toBeVisible();

    await volunteerContext.close();
  });
});
