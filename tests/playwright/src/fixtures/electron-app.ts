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
import { NavigationBar } from 'src/model/navigation/navigation';

import { waitForAppReady } from '../utils/app-ready';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const TIMEOUTS = {
  FIRST_WINDOW: 120_000,
  PAGE_LOAD: 90_000,
  WINDOW_EVENT: 120_000,
  NON_DEVTOOLS_WINDOW: 60_000,
} as const;

export async function getDevModeWindow(electronApp: ElectronApplication): Promise<Page> {
  await electronApp.waitForEvent('window', { timeout: TIMEOUTS.WINDOW_EVENT });
  const windows = electronApp.windows();
  const appWindow = windows.find(w => !w.url().startsWith('devtools://'));
  return (
    appWindow ??
    (await electronApp.waitForEvent('window', {
      timeout: TIMEOUTS.NON_DEVTOOLS_WINDOW,
      predicate: page => !page.url().startsWith('devtools://'),
    }))
  );
}

export async function launchElectronApp(): Promise<ElectronApplication> {
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

  return await electron.launch(launchConfig);
}

export async function getFirstPage(electronApp: ElectronApplication): Promise<Page> {
  const isProductionMode = !!process.env.KORTEX_BINARY;
  const page = isProductionMode
    ? await electronApp.firstWindow({ timeout: TIMEOUTS.FIRST_WINDOW })
    : await getDevModeWindow(electronApp).catch(async (error: unknown) => {
        console.error('Failed to get dev window, falling back to firstWindow:', error);
        return electronApp.firstWindow();
      });
  await page.waitForLoadState('load', { timeout: TIMEOUTS.PAGE_LOAD });
  await waitForAppReady(page);
  return page;
}

export interface ElectronFixtures {
  electronApp: ElectronApplication;
  page: Page;
  navigationBar: NavigationBar;
}

export const test = base.extend<ElectronFixtures>({
  // eslint-disable-next-line no-empty-pattern
  electronApp: async ({}, use): Promise<void> => {
    const electronApp = await launchElectronApp();
    await use(electronApp);
    await electronApp.close();
  },

  page: async ({ electronApp }, use): Promise<void> => {
    const page = await getFirstPage(electronApp);
    await use(page);
  },

  navigationBar: async ({ page }, use): Promise<void> => {
    const navigationBar = new NavigationBar(page);
    await use(navigationBar);
  },
});

export { expect } from '@playwright/test';
