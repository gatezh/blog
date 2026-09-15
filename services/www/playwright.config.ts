import { defineConfig, devices } from "@playwright/test";

/** Specs that exercise the Cloudflare Worker rather than the Hugo output. */
const WORKER_SPEC = /worker\.spec\.ts/;

/** Port `wrangler dev` binds for the worker project. */
const WORKER_PORT = 8788;

/**
 * Playwright configuration for Hugo site testing.
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: "./tests",
  outputDir: "./test-results",

  /* Run tests in parallel */
  fullyParallel: true,

  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!process.env.CI,

  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,

  /* Use fewer workers on CI for stability */
  workers: process.env.CI ? 1 : undefined,

  /* Reporter configuration */
  reporter: [["html", { open: "never" }], ["list"]],

  /* Shared settings for all projects */
  use: {
    /* Base URL for navigation */
    baseURL: "http://localhost:1313",

    /* Run in headless mode (required for containers) */
    headless: true,

    /* Collect trace on failure for debugging */
    trace: "on-first-retry",

    /* Take screenshot on failure */
    screenshot: "only-on-failure",

    /* The devcontainer image ships Chromium via apt at /usr/bin/chromium and sets
       PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1, so Playwright-managed browsers are never
       downloaded there. Point at the system binary when the image exports the path;
       undefined on the host and in CI, where Playwright uses its own browser. */
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    },
  },

  /* Configure projects for different viewports and color schemes.
     Worker tests are excluded here: they need `wrangler dev`, not `hugo
     server`, and they run in the dedicated `worker` project below. */
  projects: [
    {
      name: "desktop-light",
      testIgnore: WORKER_SPEC,
      use: {
        ...devices["Desktop Chrome"],
        colorScheme: "light",
      },
    },
    {
      name: "desktop-dark",
      testIgnore: WORKER_SPEC,
      use: {
        ...devices["Desktop Chrome"],
        colorScheme: "dark",
      },
    },
    {
      name: "mobile-light",
      testIgnore: WORKER_SPEC,
      use: {
        ...devices["Pixel 7"],
        colorScheme: "light",
      },
    },
    {
      name: "mobile-dark",
      testIgnore: WORKER_SPEC,
      use: {
        ...devices["Pixel 7"],
        colorScheme: "dark",
      },
    },
    {
      /* Content negotiation, the real 404 status and X-Robots-Tag headers are
         Worker behaviour and cannot be exercised against `hugo server`. Before
         this project existed, the only check on them was the post-deploy
         verify job — i.e. after the code was already live. */
      name: "worker",
      testMatch: WORKER_SPEC,
      use: { baseURL: `http://127.0.0.1:${WORKER_PORT}` },
    },
  ],

  /* Run local dev servers before starting tests */
  webServer: [
    {
      // --renderToMemory is required for correctness, not speed: `hugo server`
      // otherwise writes into ./public and never prunes files a rebuild no
      // longer produces, so a test asserting a URL is *gone* would pass or fail
      // on leftovers from an earlier build rather than on the config under test.
      command: "hugo server --renderToMemory --bind 0.0.0.0",
      url: "http://localhost:1313",
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
    {
      /* wrangler serves ./public, so the site has to be on disk first — this
         is the one place a real build is required rather than --renderToMemory. */
      command: `bun run build && bunx wrangler dev --local --port ${WORKER_PORT} --ip 127.0.0.1`,
      url: `http://127.0.0.1:${WORKER_PORT}/`,
      reuseExistingServer: !process.env.CI,
      timeout: 180000,
    },
  ],
});
