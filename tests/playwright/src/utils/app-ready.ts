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

import { type ElectronApplication, expect, type Locator, type Page } from '@playwright/test';

import { type DialogOptions, SELECTORS, TIMEOUTS } from '/@/model/core/types';

export interface AppReadyOptions {
  dismissWelcome?: boolean;
}

export async function waitForAppReady(
  page: Page,
  timeout: number = TIMEOUTS.DEFAULT,
  options: AppReadyOptions = {},
): Promise<void> {
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
  if (options.dismissWelcome !== false) {
    await handleWelcomePageIfPresent(page);
  }
}

export async function waitForNavigationReady(
  page: Page,
  timeout: number = TIMEOUTS.DEFAULT,
  options: AppReadyOptions = {},
): Promise<void> {
  await waitForAppReady(page, timeout, options);
  await expect(page.getByRole(SELECTORS.NAVIGATION.role, { name: SELECTORS.NAVIGATION.name })).toBeVisible({
    timeout,
  });
}

async function waitForInitializingScreenToDisappear(page: Page): Promise<void> {
  const initializingScreen = page.locator(SELECTORS.MAIN_INITIALIZING);
  await expect(initializingScreen).toBeHidden({ timeout: TIMEOUTS.INITIALIZING_SCREEN });
}

async function dismissWelcomeOverlay(page: Page, welcomePage: Locator, skipButton: Locator): Promise<void> {
  await page.bringToFront();
  await page.keyboard.press('Escape').catch(() => undefined);

  for (let attempt = 1; attempt <= 3; attempt++) {
    // Packaged Windows + CDP: scrollIntoViewIfNeeded can hang waiting for layout stability.
    await skipButton.click({ force: true, timeout: TIMEOUTS.STANDARD });

    try {
      await expect(welcomePage).toBeHidden({ timeout: 5_000 });
      return;
    } catch {
      console.log(`Welcome overlay still visible after Skip click (attempt ${attempt}/3)`);
      await page.keyboard.press('Escape').catch(() => undefined);
    }
  }

  await expect(welcomePage).toBeHidden({ timeout: TIMEOUTS.STANDARD });
}

async function handleWelcomePageIfPresent(page: Page, timeout = 5_000): Promise<void> {
  const welcomePage = page.locator(SELECTORS.WELCOME_PAGE).first();
  const skipButton = page.getByRole('button', { name: 'Skip', exact: true });
  const guidedSetupButton = page.getByRole('button', { name: 'Start guided setup', exact: true });
  const startOnboardingButton = page.getByRole('button', { name: 'Start onboarding', exact: true });

  try {
    await expect(welcomePage).not.toBeVisible({ timeout });
    return;
  } catch {
    // Welcome screen is visible — dismiss it the same way as local / Podman Desktop e2e.
  }

  await page.bringToFront();

  // Extensions load sequentially and can block the welcome footer until ready.
  const readyButton = guidedSetupButton.or(startOnboardingButton).or(skipButton);
  await expect(readyButton.first()).toBeEnabled({ timeout: 60_000 });

  await expect(skipButton).toBeEnabled({ timeout: TIMEOUTS.STANDARD });
  await dismissWelcomeOverlay(page, welcomePage, skipButton);
}

export async function handleDialogIfPresent(
  page: Page,
  {
    dialogName = 'Confirmation',
    buttonName = 'Yes',
    timeout = 5_000,
    throwErrorOnFailOrMissing = false,
    waitForDialogToDisappear = true,
  }: DialogOptions = {},
): Promise<boolean> {
  const dialog = page.getByRole('dialog', { name: dialogName, exact: true });

  try {
    await expect(dialog).toBeVisible({ timeout });
  } catch (error) {
    if (throwErrorOnFailOrMissing) {
      throw new Error(
        `Dialog "${dialogName}" not found within ${timeout}ms: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    return false;
  }

  try {
    const button = dialog.getByRole('button', { name: buttonName, exact: true });
    await expect(button).toBeEnabled({ timeout });
    await button.click();

    if (waitForDialogToDisappear) {
      await expect(dialog).toBeHidden({ timeout });
    }

    return true;
  } catch (error) {
    const errorMessage = `Failed to interact with dialog "${dialogName}" button "${buttonName}": ${
      error instanceof Error ? error.message : String(error)
    }`;
    console.error(errorMessage);

    if (throwErrorOnFailOrMissing) {
      throw new Error(errorMessage);
    }
    return false;
  }
}

export async function clearAllToasts(page: Page, toastLocator: Locator, timeout = 10_000): Promise<void> {
  await page.keyboard.press('Escape');
  await expect(toastLocator).toHaveCount(0, { timeout });
}

export async function withMockedFileDialog(
  electronApp: ElectronApplication,
  filePath: string,
  action: () => Promise<void>,
): Promise<void> {
  await electronApp.evaluate(({ dialog }, fp: string) => {
    const g = globalThis as unknown as Record<string, unknown>;
    g.__originalShowOpenDialog = dialog.showOpenDialog;
    dialog.showOpenDialog = (() =>
      Promise.resolve({ canceled: false, filePaths: [fp] })) as typeof dialog.showOpenDialog;
  }, filePath);
  try {
    await action();
  } finally {
    await electronApp.evaluate(({ dialog }) => {
      const g = globalThis as unknown as Record<string, unknown>;
      dialog.showOpenDialog = g.__originalShowOpenDialog as typeof dialog.showOpenDialog;
      delete g.__originalShowOpenDialog;
    });
  }
}
