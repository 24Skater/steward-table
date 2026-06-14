import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "../public/screenshots");
const BASE = "http://localhost:3000";

// Pre-injected session token — matches the row in the sessions table
const SESSION_TOKEN = "screenshot-session-1781324901";

async function makeAuthPage(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  // Land on a public page first so the cookie domain is established
  await page.goto(`${BASE}/home`);
  await page.context().addCookies([
    {
      name: "authjs.session-token",
      value: SESSION_TOKEN,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
    },
  ]);
  return page;
}

async function main() {
  const browser = await chromium.launch({ headless: true });

  // ── 1. Orders dashboard ──────────────────────────────────────
  console.log("Capturing orders page...");
  const dashPage = await makeAuthPage(browser);
  await dashPage.goto(`${BASE}/orders`);
  await dashPage.waitForLoadState("networkidle");
  const dashUrl = dashPage.url();
  console.log("  landed on:", dashUrl);
  await dashPage.screenshot({ path: path.join(outDir, "dashboard-orders.png") });
  console.log("  Saved dashboard-orders.png");
  await dashPage.context().close();

  // ── 2. Kitchen display ─────────────────────────────────────────
  console.log("Capturing kitchen display...");
  const kitchenPage = await makeAuthPage(browser);
  await kitchenPage.goto(`${BASE}/kitchen`);
  await kitchenPage.waitForLoadState("networkidle");
  const kitchenUrl = kitchenPage.url();
  console.log("  landed on:", kitchenUrl);
  await kitchenPage.screenshot({ path: path.join(outDir, "kitchen-display.png") });
  console.log("  Saved kitchen-display.png");
  await kitchenPage.context().close();

  // ── 3. Storefront menu (public — no auth) ──────────────────────
  console.log("Capturing storefront menu...");
  const sfCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const sfPage = await sfCtx.newPage();
  await sfPage.goto(`${BASE}/grace-fellowship/menu/sunday-lunch`);
  await sfPage.waitForLoadState("networkidle");
  const sfUrl = sfPage.url();
  console.log("  landed on:", sfUrl);
  await sfPage.screenshot({ path: path.join(outDir, "storefront-menu.png") });
  console.log("  Saved storefront-menu.png");
  await sfCtx.close();

  await browser.close();
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
