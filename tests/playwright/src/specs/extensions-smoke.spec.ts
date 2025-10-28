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
import type { ExtensionsPage } from '../model/navigation/pages/extensions-page';
import { waitForNavigationReady } from '../utils/app-ready';

let extensionsPage: ExtensionsPage;

test.beforeEach(async ({ page, navigationBar }) => {
  await waitForNavigationReady(page);
  extensionsPage = await navigationBar.navigateToExtensionsPage();
});

test.describe('Extensions page navigation', { tag: '@smoke' }, () => {
  test('[EXT-01] Extension navigation tabs are accessible', async () => {
    for (const tab of extensionsPage.getAllTabs()) {
      await expect(tab).toBeVisible();
      await expect(tab).toBeEnabled();
    }
  });

  test('[EXT-02] Search functionality filters extensions correctly', async () => {
    await expect(extensionsPage.searchField).toBeEnabled();
    for (const extension of builtInExtensions) {
      await extensionsPage.searchExtension(extension.name);
      await extensionsPage.verifySearchResults(extension.locator);
      await extensionsPage.clearSearch();
    }
  });

  test('[EXT-03] Built-in extensions lifecycle and controls validation', async () => {
    const installedPage = await extensionsPage.openInstalled();
    for (const extension of builtInExtensions) {
      await expect(installedPage.getExtension(extension.locator)).toBeVisible();
      const badge = installedPage.getExtensionBadge(extension.locator);
      await expect(badge).toBeVisible();
      await expect(badge).toHaveText(BADGE_TEXT);
      const deleteButton = installedPage.getDeleteButtonForExtension(extension.locator);
      await expect(deleteButton).toBeVisible();
      await expect(deleteButton).toBeDisabled();

      await installedPage.toggleExtensionState(extension.locator);
      await expect(deleteButton).toBeDisabled();
      await installedPage.toggleExtensionState(extension.locator);
      await expect(deleteButton).toBeDisabled();
    }
  });
});
