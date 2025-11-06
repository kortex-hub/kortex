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
import { BADGE_TEXT, builtInExtensions } from 'src/model/core/types';

import { expect, test } from '../fixtures/electron-app';
import { waitForNavigationReady } from '../utils/app-ready';

test.describe('Extensions page navigation', { tag: '@smoke' }, () => {
  test.beforeEach(async ({ page, navigationBar }) => {
    await waitForNavigationReady(page);
    await navigationBar.navigateToExtensionsPage();
  });

  test('[EXT-01] Extension navigation tabs are accessible', async ({ extensionsPage }) => {
    const tabs = extensionsPage.getAllTabs();
    const expectedTabCount = 3; // Installed, Catalog, Local Extensions

    expect(tabs).toHaveLength(expectedTabCount);

    for (const tab of tabs) {
      await expect(tab).toBeVisible();
      await expect(tab).toBeEnabled();
    }
  });

  test('[EXT-02] Search functionality filters extensions correctly', async ({ extensionsPage }) => {
    for (const extension of builtInExtensions) {
      await extensionsPage.searchExtension(extension.name);
      await extensionsPage.verifySearchResults(extension.locator);
      await extensionsPage.clearSearch();
    }
  });

  test('[EXT-03] Built-in extensions are visible with correct badges', async ({ extensionsPage }) => {
    const installedPage = await extensionsPage.openInstalledTab();

    for (const extension of builtInExtensions) {
      const extensionLocator = installedPage.getExtension(extension.locator);
      await expect(extensionLocator).toBeVisible();

      const badge = installedPage.getExtensionBadge(extension.locator);
      await expect(badge).toBeVisible();
      await expect(badge).toHaveText(BADGE_TEXT);
    }
  });

  test('[EXT-04] Built-in extensions delete button is always disabled and unaffected by toggling', async ({
    extensionsPage,
  }) => {
    const installedPage = await extensionsPage.openInstalledTab();

    for (const extension of builtInExtensions) {
      const deleteButton = installedPage.getDeleteButtonForExtension(extension.locator);
      await expect(deleteButton).toBeVisible();
      await expect(deleteButton).toBeDisabled();
    }

    const testExtension = builtInExtensions[0];
    const deleteButton = installedPage.getDeleteButtonForExtension(testExtension.locator);

    await installedPage.toggleExtensionState(testExtension.locator);
    await expect(deleteButton).toBeDisabled();

    await installedPage.toggleExtensionState(testExtension.locator);
    await expect(deleteButton).toBeDisabled();
  });
});
