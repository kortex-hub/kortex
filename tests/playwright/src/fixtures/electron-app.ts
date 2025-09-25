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
    const electronEnv = {
      ...process.env,
      ELECTRON_IS_DEV: '1',
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
