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
import { type ElectronApplication, type Page } from '@playwright/test';

import { createResource, deleteResource, type ResourceId } from '../utils/resource-helper';
import { getFirstPage, launchElectronApp, test as base } from './electron-app';

interface WorkerFixtures {
  workerElectronApp: ElectronApplication;
  workerPage: Page;
  resource: ResourceId;
  resourceSetup: void;
}

interface TestFixtures {
  electronApp: ElectronApplication;
  page: Page;
}

export const test = base.extend<TestFixtures, WorkerFixtures>({
  resource: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use): Promise<void> => {
      await use('gemini' as ResourceId);
    },
    { scope: 'worker', option: true },
  ],

  workerElectronApp: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use): Promise<void> => {
      const electronApp = await launchElectronApp();
      await use(electronApp);
      await electronApp.close();
    },
    { scope: 'worker' },
  ],

  workerPage: [
    async ({ workerElectronApp }, use): Promise<void> => {
      const page = await getFirstPage(workerElectronApp);
      await use(page);
    },
    { scope: 'worker' },
  ],

  resourceSetup: [
    async ({ workerPage, resource }, use): Promise<void> => {
      try {
        await createResource(workerPage, resource);
        await use();
      } finally {
        try {
          await deleteResource(workerPage, resource);
        } catch (error) {
          console.error(`Failed to delete ${resource} resource:`, error);
        }
      }
    },
    { scope: 'worker', auto: true },
  ],

  electronApp: async ({ workerElectronApp }, use): Promise<void> => {
    await use(workerElectronApp);
  },

  page: async ({ workerPage }, use): Promise<void> => {
    await use(workerPage);
  },
});

export { expect } from '@playwright/test';
