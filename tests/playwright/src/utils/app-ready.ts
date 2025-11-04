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

import { expect, type Locator, type Page } from '@playwright/test';

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
  await expect(initializingScreen).toBeHidden({ timeout: TIMEOUTS.INITIALIZING_SCREEN });
}

async function handleWelcomePageIfPresent(page: Page, timeout = 5_000): Promise<void> {
  const welcomePage = page.locator(SELECTORS.WELCOME_PAGE).first();

  try {
    await expect(welcomePage).not.toBeVisible({ timeout: timeout });
  } catch {
    const skipButton = page.getByRole('button', { name: 'Skip' });
    await skipButton.click();
    await expect(welcomePage).toBeHidden({ timeout: TIMEOUTS.WELCOME_PAGE });
  }
}

export async function handleDialogIfPresent(
  page: Page,
  {
    dialogName = 'Confirmation',
    buttonName = 'Yes',
    timeout = 5_000,
    throwErrorOnFailOrMissing = false,
  }: { dialogName?: string; buttonName?: string; timeout?: number; throwErrorOnFailOrMissing?: boolean } = {},
): Promise<void> {
  try {
    const dialog = page.getByRole('dialog', { name: dialogName });
    await expect(dialog).toBeVisible({ timeout });

    const button = dialog.getByRole('button', { name: buttonName });
    await expect(button).toBeEnabled({ timeout });
    await button.click();
  } catch (error) {
    console.log(`Dialog "${dialogName}" with button "${buttonName}" not found or failed to interact.`);
    if (throwErrorOnFailOrMissing) {
      throw error;
    }
  }
}

export async function dropdownAction<T>(page: Page, dropdownSelector: Locator, action: () => Promise<T>): Promise<T> {
  try {
    await dropdownSelector.click();
    const result = await action();
    return result;
  } catch (error) {
    console.error('Dropdown action failed:', error);
    throw error;
  } finally {
    try {
      await page.keyboard.press('Escape');
    } catch (closeError) {
      console.warn('Failed to close dropdown with Escape key:', closeError);
    }
  }
}

export async function clearAllToasts(page: Page, toastLocator: Locator, timeout = 10_000): Promise<void> {
  await page.keyboard.press('Escape');
  await expect(toastLocator).toHaveCount(0, { timeout });
}
