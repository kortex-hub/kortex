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

const TIMEOUTS = {
  DEFAULT: 120_000,
  INITIALIZING_SCREEN: 180_000,
  WELCOME_PAGE: 30_000,
} as const;

const SELECTORS = {
  MAIN_ANY: 'main',
  MAIN_INITIALIZING: 'main.flex.flex-row.w-screen.h-screen.justify-center',
  MAIN_APP_CONTAINER: 'main.flex.flex-col.w-screen.h-screen.overflow-hidden',
  TITLE_BAR: 'header#navbar',
  WELCOME_PAGE: 'div:has-text("Get started with Kortex")',
  NAVIGATION: { role: 'navigation' as const, name: 'AppNavigation' },
} as const;

export async function waitForAppReady(page: Page, timeout = TIMEOUTS.DEFAULT): Promise<void> {
  try {
    await expect(page.locator(SELECTORS.MAIN_ANY).first()).toBeVisible({ timeout });
  } catch (error) {
    const url = page.url();
    const title = await page.title().catch(() => 'Unable to get title');
    const html = await page.content().catch(() => 'Unable to get content');
    console.error('Failed to find main element. Page state:', { url, title, htmlLength: html.length });
    throw error;
  }
  await waitForInitializingScreenToDisappear(page);
  await expect(page.locator(SELECTORS.MAIN_APP_CONTAINER)).toBeVisible({ timeout });
  await expect(page.locator(SELECTORS.TITLE_BAR)).toBeVisible({ timeout });
  await handleWelcomePageIfPresent(page);
}

export async function waitForNavigationReady(page: Page, timeout = TIMEOUTS.DEFAULT): Promise<void> {
  await waitForAppReady(page, timeout);
  await expect(page.getByRole(SELECTORS.NAVIGATION.role, { name: SELECTORS.NAVIGATION.name })).toBeVisible({
    timeout,
  });
}

async function waitForInitializingScreenToDisappear(page: Page): Promise<void> {
  const initializingScreen = page.locator(SELECTORS.MAIN_INITIALIZING);
  const isInitializing = await initializingScreen.isVisible().catch(() => false);

  if (isInitializing) {
    await expect(initializingScreen).toBeHidden({ timeout: TIMEOUTS.INITIALIZING_SCREEN });
  }
}

async function handleWelcomePageIfPresent(page: Page): Promise<void> {
  const welcomePage = page.locator(SELECTORS.WELCOME_PAGE).first();

  try {
    const isVisible = await welcomePage.isVisible({ timeout: 5_000 });
    if (isVisible) {
      const skipButton = page.getByRole('button', { name: 'Skip' });
      await skipButton.click();
      await expect(welcomePage).toBeHidden({ timeout: TIMEOUTS.WELCOME_PAGE });
    }
  } catch {
    // Welcome page not present or already dismissed - expected on subsequent runs
  }
}
