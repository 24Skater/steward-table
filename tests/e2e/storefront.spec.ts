import { expect, test } from "@playwright/test";

// These tests use a mock church slug — they should work even without
// a running database by testing the page structure/routing

test.describe("Storefront", () => {
  test("marketing home page loads", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Steward Table/);
    // Expects redirect to /home
    await page.waitForURL("**/home");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("sign-in page has required fields", async ({ page }) => {
    await page.goto("/auth/sign-in");
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  });

  test("sign-in page shows error on bad credentials", async ({ page }) => {
    await page.goto("/auth/sign-in?error=CredentialsSignin");
    await expect(page.getByText(/incorrect email or password/i)).toBeVisible();
  });

  test("dashboard redirects unauthenticated users to sign-in", async ({ page }) => {
    await page.goto("/orders");
    await page.waitForURL("**/auth/sign-in**");
    await expect(page.url()).toContain("/auth/sign-in");
  });

  test("unknown page shows 404", async ({ page }) => {
    const response = await page.goto("/this-page-does-not-exist-at-all");
    // Next.js returns 404 for unknown pages
    expect(response?.status()).toBe(404);
  });
});
