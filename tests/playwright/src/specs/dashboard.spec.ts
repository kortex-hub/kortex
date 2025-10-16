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
import { expect, test } from '../fixtures/electron-app';
import { NavigationBar } from '../model/navigation/navigation';

let navigationBar: NavigationBar;

test.beforeEach(async ({ page }) => {
  navigationBar = new NavigationBar(page);
});

test.describe.serial('App start', { tag: '@smoke' }, () => {
  test('[TC-01] Initial Dashboard page is displayed', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'No AI Models Available' })).toBeVisible({ timeout: 30_000 });
  });

  test('[TC-02] Navigation bar and its items are visible', async () => {
    await expect(navigationBar.navigationLocator).toBeVisible();

    for (const link of navigationBar.getAllLinks()) {
      await expect(link).toBeVisible();
    }
  });
});
