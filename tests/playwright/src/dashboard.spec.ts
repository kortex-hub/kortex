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
import { expect as playExpect } from '@playwright/test';
import { RunnerOptions, test } from '@podman-desktop/tests-playwright';

import { NavigationBar } from './model/navigation/navigation';

let navigationBar: NavigationBar;

test.use({ runnerOptions: new RunnerOptions({ customFolder: 'kortex-dashboard' }) });
test.beforeAll(async ({ runner, page }) => {
  runner.setVideoAndTraceName('dashboard-e2e');
  navigationBar = new NavigationBar(page);
});

test.afterAll(async ({ runner }) => {
  await runner.close();
});

test.describe.serial('Kortex app start', { tag: '@smoke' }, () => {
  test.describe
    .serial('Application dashboard is opened', () => {
      test('Initial Dashboard page is displayed', async ({ page }) => {
        await playExpect(page.getByRole('heading', { name: 'No AI Models Available' })).toBeVisible({
          timeout: 15_000,
        });
      });

      test('Navigation bar and its items are visible', async () => {
        await playExpect(navigationBar.navigationLocator).toBeVisible();
        await playExpect(navigationBar.chatLink).toBeVisible();
        await playExpect(navigationBar.flowsLink).toBeVisible();
        await playExpect(navigationBar.mcpLink).toBeVisible();
        await playExpect(navigationBar.extensionsLink).toBeVisible();
        await playExpect(navigationBar.settingsLink).toBeVisible();
      });
    });
});
