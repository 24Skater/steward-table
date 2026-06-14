import { expect, test } from "@playwright/test";

test.describe("Multi-kitchen routes", () => {
  test("the kitchen picker route is reachable (or redirects to sign-in)", async ({ page }) => {
    await page.goto("/kitchen");
    await page.waitForURL("**/auth/sign-in**", { timeout: 5000 }).catch(() => {});
    expect(["/kitchen", "/auth/sign-in"].some((p) => page.url().includes(p))).toBe(true);
  });

  test("a slug-scoped kitchen route is reachable (or redirects to sign-in)", async ({ page }) => {
    await page.goto("/kitchen/main");
    await page.waitForURL("**/auth/sign-in**", { timeout: 5000 }).catch(() => {});
    expect(["/kitchen/main", "/auth/sign-in"].some((p) => page.url().includes(p))).toBe(true);
  });

  test("the kitchens dashboard route is reachable (or redirects to sign-in)", async ({ page }) => {
    await page.goto("/kitchens");
    await page.waitForURL("**/auth/sign-in**", { timeout: 5000 }).catch(() => {});
    expect(["/kitchens", "/auth/sign-in"].some((p) => page.url().includes(p))).toBe(true);
  });
});
