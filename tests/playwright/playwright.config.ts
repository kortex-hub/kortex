import { devices, type PlaywrightTestConfig } from '@playwright/test';

/**
 * See https://playwright.dev/docs/test-configuration.
 */
const config: PlaywrightTestConfig = {
  testDir: './src',
  /* Maximum time one test can run for. */
  timeout: 120_000,
  expect: {
    /**
     * Maximum time expect() should wait for the condition to be met.
     * For example in `await expect(locator).toHaveText();`
     */
    timeout: 10_000,
  },
  /* Run tests in files in parallel */
  fullyParallel: false,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: 1,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['html', { outputFolder: './output/html-results' }],
    ['json', { outputFile: './output/test-results.json' }],
    ['junit', { outputFile: './output/junit-results.xml' }],
    ['list'],
  ],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Maximum time each action such as `click()` can take. Defaults to 0 (no limit). */
    actionTimeout: 10_000,
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'retain-on-failure',
    /* Take screenshot when test fails */
    screenshot: 'only-on-failure',
    /* Record video on failure */
    video: 'retain-on-failure',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'Electron',
      use: {
        ...devices['Desktop Chrome'],
        // Electron launch handled by @podman-desktop/tests-playwright
      },
      testMatch: '**/*.spec.ts',
    },
  ],

  /* Folder for test artifacts such as screenshots, videos, traces, etc. */
  outputDir: './output/test-results',

  /* No webServer needed - tests launch Electron directly */
};

export default config;
