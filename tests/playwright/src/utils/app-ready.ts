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

import { expect, type Page } from '@playwright/test';

export async function waitForAppReady(page: Page, timeout = 120_000): Promise<void> {
  await expect(page.locator('main').first()).toBeVisible({ timeout });
  const initializingScreen = page.locator('main.flex.flex-row.w-screen.h-screen.justify-center');
  const isInitializing = await initializingScreen.isVisible().catch(() => false);
  if (isInitializing) {
    await expect(initializingScreen).toBeHidden({ timeout: 180_000 });
  }
  await expect(page.locator('main.flex.flex-col.w-screen.h-screen.overflow-hidden')).toBeVisible({ timeout });
  await expect(page.locator('header#navbar')).toBeVisible({ timeout });
  const welcomePage = page.locator('div:has-text("Get started with Kortex")').first();
  try {
    await expect(welcomePage).toBeHidden({ timeout: 30_000 });
  } catch {
    // Welcome page not present or already hidden, continue
  }
}

export async function waitForNavigationReady(page: Page, timeout = 120_000): Promise<void> {
  await waitForAppReady(page, timeout);
  await expect(page.getByRole('navigation', { name: 'AppNavigation' })).toBeVisible({ timeout });
}
