import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  /**
   * Started here so CI is self-contained, reused locally.
   *
   * `reuseExistingServer` off CI means a developer with `pnpm dev` already
   * running keeps their fast refresh; in CI there is nothing to reuse, so
   * Playwright builds and starts the app itself. Without this the suite could
   * only ever run on a machine where somebody had remembered to start a server,
   * which is why it had never run in CI at all.
   */
  webServer: {
    // NEXT_DISABLE_STANDALONE so `next start` can actually serve what was
    // built; see next.config.ts for why standalone output does not work here.
    command: process.env.CI ? "NEXT_DISABLE_STANDALONE=1 pnpm build && pnpm start" : "pnpm dev",
    url: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    // A cold Next build is slow, and a timeout here reads as a mysterious
    // suite failure rather than "the build had not finished".
    timeout: 240_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
