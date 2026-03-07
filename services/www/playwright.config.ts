import { defineConfig, devices } from "@playwright/test";

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
  },

  /* Configure projects for different viewports and color schemes */
  projects: [
    {
      name: "desktop-light",
      use: {
        ...devices["Desktop Chrome"],
        colorScheme: "light",
      },
    },
    {
      name: "desktop-dark",
      use: {
        ...devices["Desktop Chrome"],
        colorScheme: "dark",
      },
    },
    {
      name: "mobile-light",
      use: {
        ...devices["Pixel 7"],
        colorScheme: "light",
      },
    },
    {
      name: "mobile-dark",
      use: {
        ...devices["Pixel 7"],
        colorScheme: "dark",
      },
    },
  ],

  /* Run local dev server before starting tests */
  webServer: {
    command: "hugo server --bind 0.0.0.0",
    url: "http://localhost:1313",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
