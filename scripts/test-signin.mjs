import { chromium } from "@playwright/test";

const BASE = "http://localhost:3000";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  // Sign in
  await page.goto(`${BASE}/auth/sign-in?callbackUrl=%2Fonboarding`);
  await page.fill('input[name="email"]', "emerson.ramoszelaya@gmail.com");
  await page.fill('input[name="password"]', "steward123");
  await page.click('button[type="submit"]:first-of-type');
  await new Promise((r) => setTimeout(r, 4000));

  console.log("URL after sign-in:", page.url());

  const bodyText = await page.textContent("body").catch(() => "");
  const clean = bodyText.replace(/\s+/g, " ").trim();
  console.log("Body content:", clean.slice(0, 600));

  // Take a screenshot
  await page.screenshot({ path: "scripts/onboarding-test.png", fullPage: true });
  console.log("Screenshot saved to scripts/onboarding-test.png");

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
