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
import {
  BADGE_TEXT,
  builtInExtensions,
  Button,
  ExtensionStatus,
} from '../model/navigation/pages/extensions-installed-tab-page';
import { ExtensionsPage } from '../model/navigation/pages/extensions-page';
import { waitForNavigationReady } from '../utils/app-ready';

let navigationBar: NavigationBar;
let extensionsPage: ExtensionsPage;

test.beforeEach(async ({ page }) => {
  navigationBar = new NavigationBar(page);
  extensionsPage = new ExtensionsPage(page);
  await waitForNavigationReady(page);
  await navigationBar.extensionsLink.click();
});

test.describe('Extensions page navigation', { tag: '@smoke' }, () => {
  test('[TC-01] Extension navigation tabs are accessible', async () => {
    for (const tab of extensionsPage.getAllTabs()) {
      await expect(tab).toBeVisible();
      await expect(tab).toBeEnabled();
    }
  });

  test('[TC-02] Search functionality filters extensions correctly', async () => {
    await expect(extensionsPage.searchField).toBeVisible();
    await expect(extensionsPage.searchField).toBeEnabled();
    for (const extension of builtInExtensions) {
      await extensionsPage.searchExtension(extension.name);
      await expect(extensionsPage.searchField).toHaveValue(extension.name);
      await extensionsPage.verifySearchResults(extension.locator);
      await extensionsPage.clearSearch();
    }
  });

  test('[TC-03] Built-in extensions lifecycle and controls validation', async () => {
    const installedPage = await extensionsPage.openInstalled();
    for (const extension of builtInExtensions) {
      await expect(installedPage.getExtension(extension.locator)).toBeVisible();
      const badge = installedPage.getExtensionBadge(extension.locator);
      await expect(badge).toBeVisible();
      await expect(badge).toHaveText(BADGE_TEXT);
      const deleteButton = installedPage.getExtensionButton(extension.locator, Button.DELETE);
      await expect(deleteButton).toBeVisible();
      await expect(deleteButton).toBeDisabled();
      const initialState = await installedPage.getExtensionState(extension.locator);
      if (initialState === ExtensionStatus.RUNNING) {
        await installedPage.stopExtensionAndVerify(extension.locator);
        await expect(deleteButton).toBeDisabled();
        await installedPage.startExtensionAndVerify(extension.locator);
        await expect(deleteButton).toBeDisabled();
      } else if (initialState === ExtensionStatus.STOPPED) {
        await installedPage.startExtensionAndVerify(extension.locator);
        await expect(deleteButton).toBeDisabled();
        await installedPage.stopExtensionAndVerify(extension.locator);
        await expect(deleteButton).toBeDisabled();
      }
    }
  });
});
