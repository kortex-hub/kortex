import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { _electron as electron, type ElectronApplication, type Page, test as base } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface ElectronFixtures {
  electronApp: ElectronApplication;
  page: Page;
}

/**
 * Custom Playwright fixtures for Kortex Electron app testing
 */
export const test = base.extend<ElectronFixtures>({
  // eslint-disable-next-line no-empty-pattern
  electronApp: async ({}, use) => {
    // Launch Kortex Electron app using same approach as pnpm watch
    const electronEnv: { [key: string]: string } = {
      ...process.env,
      NODE_ENV: 'development',
      ELECTRON_IS_DEV: '1', // Convert to string for environment compatibility
      ELECTRON_DISABLE_SANDBOX: '1',
    } as { [key: string]: string };

    // Remove any Node.js specific environment that might interfere
    delete electronEnv.ELECTRON_RUN_AS_NODE;
    delete electronEnv.npm_execpath;
    delete electronEnv.npm_config_user_config;

    const electronApp = await electron.launch({
      args: [
        // Use current directory like watch script, not direct path
        '.',
        // Include remote debugging port like watch script
        '--remote-debugging-port=9223',
        // Add safety flags for testing
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
      env: electronEnv as { [key: string]: string },
      cwd: resolve(__dirname, '../../../..'), // Set working directory to project root
      timeout: 60000,
    });

    await use(electronApp);

    await electronApp.close();
  },

  page: async ({ electronApp }, use) => {
    console.log('⏳ Waiting for Kortex app initialization...');

    // Wait for app initialization
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Get the main window
    const page = await electronApp.firstWindow();

    // Wait for the app to load
    await page.waitForLoadState('domcontentloaded', { timeout: 30000 });

    // Set a reasonable viewport size
    await page.setViewportSize({ width: 1280, height: 720 });

    await use(page);
  },
});

export { expect } from '@playwright/test';
