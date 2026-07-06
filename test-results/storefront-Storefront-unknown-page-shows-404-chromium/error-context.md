# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: storefront.spec.ts >> Storefront >> unknown page shows 404
- Location: tests\e2e\storefront.spec.ts:33:7

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 404
Received: 500
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e4]:
    - img [ref=e6]
    - heading "Something went wrong" [level=1] [ref=e8]
    - paragraph [ref=e9]: An unexpected error occurred. Please try again or return to the dashboard.
    - generic [ref=e10]:
      - button "Try again" [ref=e11]
      - link "Go to dashboard" [ref=e12] [cursor=pointer]:
        - /url: /orders
    - paragraph [ref=e13]: "Error reference: 3051131452"
  - alert [ref=e14]
```

# Test source

```ts
  1  | import { expect, test } from "@playwright/test";
  2  | 
  3  | // These tests use a mock church slug — they should work even without
  4  | // a running database by testing the page structure/routing
  5  | 
  6  | test.describe("Storefront", () => {
  7  |   test("marketing home page loads", async ({ page }) => {
  8  |     await page.goto("/");
  9  |     await expect(page).toHaveTitle(/Steward · Table/);
  10 |     // Expects redirect to /home
  11 |     await page.waitForURL("**/home");
  12 |     await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  13 |   });
  14 | 
  15 |   test("sign-in page has required fields", async ({ page }) => {
  16 |     await page.goto("/auth/sign-in");
  17 |     await expect(page.getByLabel("Email")).toBeVisible();
  18 |     await expect(page.getByLabel("Password")).toBeVisible();
  19 |     await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  20 |   });
  21 | 
  22 |   test("sign-in page shows error on bad credentials", async ({ page }) => {
  23 |     await page.goto("/auth/sign-in?error=CredentialsSignin");
  24 |     await expect(page.getByText(/incorrect email or password/i)).toBeVisible();
  25 |   });
  26 | 
  27 |   test("dashboard redirects unauthenticated users to sign-in", async ({ page }) => {
  28 |     await page.goto("/orders");
  29 |     await page.waitForURL("**/auth/sign-in**");
  30 |     await expect(page.url()).toContain("/auth/sign-in");
  31 |   });
  32 | 
  33 |   test("unknown page shows 404", async ({ page }) => {
  34 |     const response = await page.goto("/this-page-does-not-exist-at-all");
  35 |     // Next.js returns 404 for unknown pages
> 36 |     expect(response?.status()).toBe(404);
     |                                ^ Error: expect(received).toBe(expected) // Object.is equality
  37 |   });
  38 | });
  39 | 
```