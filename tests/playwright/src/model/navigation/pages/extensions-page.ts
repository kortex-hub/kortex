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

import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';

import { BasePage } from './base-page';
import { builtInExtensions, type ExtensionLocator } from './extensions-installed-tab-page';
import { ExtensionsInstalledPage } from './extensions-installed-tab-page';

export class ExtensionsPage extends BasePage {
  readonly searchField: Locator;
  readonly installedTab: Locator;
  readonly catalogTab: Locator;
  readonly localExtensionsTab: Locator;

  constructor(page: Page) {
    super(page);
    this.searchField = page.getByLabel('search extensions');
    this.installedTab = page.getByRole('button', { name: 'Installed', exact: true });
    this.catalogTab = page.getByRole('button', { name: 'Catalog', exact: true });
    this.localExtensionsTab = page.getByRole('button', { name: 'Local Extensions', exact: true });
  }

  async openInstalled(): Promise<ExtensionsInstalledPage> {
    await this.installedTab.click();
    const installedPage = new ExtensionsInstalledPage(this.page);
    await installedPage.waitForLoad();
    return installedPage;
  }

  getAllTabs(): Locator[] {
    return [this.installedTab, this.catalogTab, this.localExtensionsTab];
  }

  async searchExtension(searchTerm: string): Promise<void> {
    await this.searchField.fill(searchTerm);
  }

  async clearSearch(): Promise<void> {
    await this.searchField.clear();
  }

  async verifySearchResults(searchedExtensionLocator: ExtensionLocator): Promise<void> {
    const installedPage = new ExtensionsInstalledPage(this.page);
    await expect(installedPage.getExtension(searchedExtensionLocator)).toBeVisible();
    for (const otherExtension of builtInExtensions.filter(
      extension => extension.locator !== searchedExtensionLocator,
    )) {
      await expect(installedPage.getExtension(otherExtension.locator)).not.toBeVisible();
    }
  }
}
