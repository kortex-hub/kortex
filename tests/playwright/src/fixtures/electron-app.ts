/**********************************************************************
 * Copyright (C) 2025 Red Hat, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 ***********************************************************************/
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
    // Filter out undefined values from process.env
    const electronEnv: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined) {
        electronEnv[key] = value;
      }
    }

    delete electronEnv.ELECTRON_RUN_AS_NODE;

    // Check if KORTEX_BINARY is set (production mode) or use development mode
    const isProductionMode = !!process.env.KORTEX_BINARY;
    const launchConfig = isProductionMode
      ? {
          // Production mode: use the built binary
          executablePath: process.env.KORTEX_BINARY!,
          args: ['--no-sandbox'],
          env: electronEnv,
        }
      : {
          // Development mode: use the source code
          args: ['.', '--no-sandbox'],
          env: {
            ...electronEnv,
            ELECTRON_IS_DEV: '1',
          },
          cwd: resolve(__dirname, '../../../..'),
        };

    const electronApp = await electron.launch(launchConfig);

    await use(electronApp);

    await electronApp.close();
  },

  page: async ({ electronApp }, use) => {
    let page: Page;
    try {
      page = await electronApp.firstWindow({ timeout: 120_000 });
    } catch (error) {
      console.error('Failed to get first window:', error);
      throw error;
    }
    await page.waitForLoadState('load', { timeout: 90_000 });
    try {
      await page.waitForSelector('main', { timeout: 30_000, state: 'attached' });
    } catch (error) {
      const url = page.url();
      const isClosed = page.isClosed();
      console.error('Page fixture failed - main element not found:', { url, isClosed });
      throw error;
    }

    await use(page);
  },
});

export { expect } from '@playwright/test';
