# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: storefront.spec.ts >> Storefront >> sign-in page has required fields
- Location: tests\e2e\storefront.spec.ts:15:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByLabel('Email')
Expected: visible
Error: strict mode violation: getByLabel('Email') resolved to 2 elements:
    1) <input id="email" required="" type="email" name="email" autocomplete="email" placeholder="you@church.org" class="flex w-full rounded-md border bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm h-10 border-slate-300 focus…/> aka getByRole('textbox', { name: 'Email', exact: true })
    2) <input type="email" id="magic-email" name="magic-email" autocomplete="email" placeholder="you@church.org" class="flex w-full rounded-md border bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm h-10 border-slate-300 focus…/> aka getByRole('textbox', { name: 'Or get a sign-in link by email' })

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByLabel('Email')

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e4]:
    - heading "Steward · Table" [level=1] [ref=e5]
    - paragraph [ref=e6]: Order management for churches and ministries
  - generic [ref=e7]:
    - generic [ref=e8]:
      - generic [ref=e9]: Sign in
      - generic [ref=e10]: Use your email and password or continue with Google.
    - generic [ref=e11]:
      - generic [ref=e12]:
        - generic [ref=e13]:
          - text: Email
          - textbox "Email" [ref=e14]:
            - /placeholder: you@church.org
        - generic [ref=e15]:
          - text: Password
          - textbox "Password" [ref=e16]
        - button "Sign in" [ref=e17]
      - generic [ref=e21]: or
      - button "Continue with Google" [ref=e23]
      - generic [ref=e25]:
        - text: Or get a sign-in link by email
        - generic [ref=e26]:
          - textbox "Or get a sign-in link by email" [ref=e27]:
            - /placeholder: you@church.org
          - button "Send link" [ref=e28]
  - paragraph [ref=e29]: Member access is by invitation only. Contact your church administrator.
  - paragraph [ref=e30]:
    - text: Setting up a new church?
    - link "Register your organization" [ref=e31] [cursor=pointer]:
      - /url: /auth/sign-in?callbackUrl=%2Fonboarding
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
> 17 |     await expect(page.getByLabel("Email")).toBeVisible();
     |                                            ^ Error: expect(locator).toBeVisible() failed
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
  36 |     expect(response?.status()).toBe(404);
  37 |   });
  38 | });
  39 | 
```