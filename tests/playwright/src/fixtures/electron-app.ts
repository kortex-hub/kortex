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

/** biome-ignore-all lint/correctness/noEmptyPattern: Playwright fixture pattern requires empty object when no dependencies are needed */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { _electron as electron, type ElectronApplication, type Page, test as base } from '@playwright/test';
import { TIMEOUTS } from 'src/model/core/types';
import { NavigationBar } from 'src/model/navigation/navigation';
import { ChatPage } from 'src/model/pages/chat-page';
import { ExtensionsPage } from 'src/model/pages/extensions-page';
import { FlowsPage } from 'src/model/pages/flows-page';
import { McpPage } from 'src/model/pages/mcp-page';
import { SettingsPage } from 'src/model/pages/settings-page';

import { waitForAppReady } from '../utils/app-ready';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DEVTOOLS_URL_PREFIX = 'devtools://';

export interface ElectronFixtures {
  electronApp: ElectronApplication;
  page: Page;
  navigationBar: NavigationBar;
  settingsPage: SettingsPage;
  flowsPage: FlowsPage;
  mcpPage: McpPage;
  extensionsPage: ExtensionsPage;
  chatPage: ChatPage;
}

export const test = base.extend<ElectronFixtures>({
  // eslint-disable-next-line no-empty-pattern
  electronApp: async ({}, use): Promise<void> => {
    let electronApp: ElectronApplication | undefined;

    try {
      electronApp = await launchElectronApp();
      await use(electronApp);
    } finally {
      if (electronApp) {
        try {
          await closeAllWindows(electronApp);
          await electronApp.close();
        } catch (error) {
          console.error('Error closing Electron app:', error);
          try {
            await electronApp.close();
          } catch {
            // Ignore errors during forced close
          }
        }
      }
    }
  },

  page: async ({ electronApp }, use): Promise<void> => {
    const page = await getFirstPage(electronApp);
    await use(page);
  },

  navigationBar: async ({ page }, use): Promise<void> => {
    const navigationBar = new NavigationBar(page);
    await use(navigationBar);
  },

  settingsPage: async ({ page }, use): Promise<void> => {
    const settingsPage = new SettingsPage(page);
    await use(settingsPage);
  },

  flowsPage: async ({ page }, use): Promise<void> => {
    const flowsPage = new FlowsPage(page);
    await use(flowsPage);
  },

  mcpPage: async ({ page }, use): Promise<void> => {
    const mcpPage = new McpPage(page);
    await use(mcpPage);
  },

  extensionsPage: async ({ page }, use): Promise<void> => {
    const extensionsPage = new ExtensionsPage(page);
    await use(extensionsPage);
  },

  chatPage: async ({ page }, use): Promise<void> => {
    const chatPage = new ChatPage(page);
    await use(chatPage);
  },
});

function isDevToolsWindow(url: string): boolean {
  return url.startsWith(DEVTOOLS_URL_PREFIX);
}

function filterNonDevToolsWindows(windows: Page[]): Page[] {
  return windows.filter(w => !isDevToolsWindow(w.url()));
}

export async function getDevModeWindow(
  electronApp: ElectronApplication,
  retries = TIMEOUTS.MAX_RETRIES,
): Promise<Page> {
  let lastError: Error | unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const existingWindows = filterNonDevToolsWindows(electronApp.windows());
      if (existingWindows.length > 0) {
        return existingWindows[0];
      }

      return await electronApp.waitForEvent('window', {
        timeout: TIMEOUTS.NON_DEVTOOLS_WINDOW,
        predicate: page => !isDevToolsWindow(page.url()),
      });
    } catch (error) {
      lastError = error;
      if (attempt < retries) {
        const delay = TIMEOUTS.RETRY_DELAY * (attempt + 1);
        console.warn(
          `Failed to get dev window (attempt ${attempt + 1}/${retries + 1}), retrying in ${delay}ms:`,
          error,
        );
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  console.error('Failed to get dev window after retries, falling back to firstWindow:', lastError);
  const allWindows = electronApp.windows();
  if (allWindows.length > 0) {
    return allWindows[0];
  }

  throw new Error(`Failed to get any window from Electron app: ${lastError}`);
}

function prepareElectronEnv(): Record<string, string> {
  const electronEnv: Record<string, string> = {};

  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && typeof value === 'string') {
      electronEnv[key] = value;
    }
  }
  // Remove Electron-specific variables that shouldn't be passed
  delete electronEnv.ELECTRON_RUN_AS_NODE;

  return electronEnv;
}

function createLaunchConfig(): Parameters<typeof electron.launch>[0] {
  const isProductionMode = !!process.env.KORTEX_BINARY;
  const electronEnv = prepareElectronEnv();

  if (isProductionMode) {
    const executablePath = process.env.KORTEX_BINARY;
    if (!executablePath) {
      throw new Error('KORTEX_BINARY environment variable is set but empty');
    }

    return {
      executablePath,
      args: ['--no-sandbox'],
      env: electronEnv,
    };
  }

  // Development mode
  return {
    args: ['.', '--no-sandbox'],
    env: {
      ...electronEnv,
      ELECTRON_IS_DEV: '1',
    },
    cwd: resolve(__dirname, '../../../..'),
  };
}

export async function launchElectronApp(): Promise<ElectronApplication> {
  const launchConfig = createLaunchConfig();

  try {
    const electronApp = await electron.launch(launchConfig);

    return electronApp;
  } catch (error) {
    console.error('Failed to launch Electron app:', error);
    throw new Error(`Failed to launch Electron app: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function getFirstPage(electronApp: ElectronApplication): Promise<Page> {
  const isProductionMode = !!process.env.KORTEX_BINARY;
  let page: Page;

  try {
    if (isProductionMode) {
      page = await electronApp.firstWindow({ timeout: TIMEOUTS.DEFAULT });
    } else {
      page = await getDevModeWindow(electronApp);
    }
  } catch (error) {
    const allWindows = electronApp.windows();
    if (allWindows.length > 0) {
      const nonDevToolsWindows = filterNonDevToolsWindows(allWindows);
      page = nonDevToolsWindows.length > 0 ? nonDevToolsWindows[0] : allWindows[0];
      console.warn('Using fallback window selection after error:', error);
    } else {
      throw new Error(`Failed to get first page: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  await page.waitForLoadState('load', { timeout: TIMEOUTS.PAGE_LOAD });
  await waitForAppReady(page);

  return page;
}

export async function closeAllWindows(electronApp: ElectronApplication): Promise<void> {
  const windows = electronApp.windows();
  await Promise.allSettled(windows.map(window => window.close().catch(() => {})));
}

export { expect } from '@playwright/test';
