import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { _electron as electron, type ElectronApplication, type Page, test as base } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface ElectronFixtures {
  electronApp: ElectronApplication;
  page: Page;
}

export const test = base.extend<ElectronFixtures>({
  // eslint-disable-next-line no-empty-pattern
  electronApp: async ({}, use) => {
    const electronEnv = {
      ...process.env,
      NODE_ENV: 'development',
      ELECTRON_IS_DEV: '1',
      ELECTRON_DISABLE_SANDBOX: '1',
    };

    delete (electronEnv as Record<string, string | undefined>).ELECTRON_RUN_AS_NODE;

    const electronApp = await electron.launch({
      args: ['.', '--no-sandbox'],
      env: electronEnv,
      cwd: resolve(__dirname, '../../../..'),
    });

    await use(electronApp);

    await electronApp.close();
  },

  page: async ({ electronApp }, use) => {
    await new Promise(resolve => setTimeout(resolve, 3000));
    const page = await electronApp.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    await page.setViewportSize({ width: 1280, height: 720 });
    await use(page);
  },
});

export { expect } from '@playwright/test';
