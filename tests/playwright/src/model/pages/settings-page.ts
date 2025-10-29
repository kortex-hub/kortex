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

import { BasePage } from './base-page';
import { SettingsCliPage } from './settings-cli-tab-page';
import { SettingsPreferencesPage } from './settings-preferences-tab-page';
import { SettingsProxyPage } from './settings-proxy-tab-page';
import { SettingsResourcesPage } from './settings-resources-tab-page';

export class SettingsPage extends BasePage {
  readonly resourcesTab: Locator;
  readonly cliTab: Locator;
  readonly proxyTab: Locator;
  readonly preferencesTab: Locator;

  constructor(page: Page) {
    super(page);
    this.resourcesTab = page.getByRole('link', { name: 'Resources' });
    this.cliTab = page.getByRole('link', { name: 'CLI' });
    this.proxyTab = page.getByRole('link', { name: 'Proxy' });
    this.preferencesTab = page.getByRole('link', { name: 'Preferences' });
  }

  async waitForLoad(): Promise<void> {
    await expect(this.resourcesTab).toBeVisible();
    await expect(this.cliTab).toBeVisible();
    await expect(this.proxyTab).toBeVisible();
    await expect(this.preferencesTab).toBeVisible();
  }

  async openResources(): Promise<SettingsResourcesPage> {
    await expect(this.resourcesTab).toBeVisible();
    await this.resourcesTab.click();

    const resourcesPage = new SettingsResourcesPage(this.page);
    await resourcesPage.waitForLoad();
    return resourcesPage;
  }

  async openCli(): Promise<SettingsCliPage> {
    await expect(this.cliTab).toBeVisible();
    await this.cliTab.click();

    const cliPage = new SettingsCliPage(this.page);
    await cliPage.waitForLoad();
    return cliPage;
  }

  async openProxy(): Promise<SettingsProxyPage> {
    await expect(this.proxyTab).toBeVisible();
    await this.proxyTab.click();

    const proxyPage = new SettingsProxyPage(this.page);
    await proxyPage.waitForLoad();
    return proxyPage;
  }

  async openPreferences(): Promise<SettingsPreferencesPage> {
    await expect(this.preferencesTab).toBeVisible();
    await this.preferencesTab.click();

    const preferencesPage = new SettingsPreferencesPage(this.page);
    await preferencesPage.waitForLoad();
    return preferencesPage;
  }

  getAllTabs(): Locator[] {
    return [this.resourcesTab, this.cliTab, this.proxyTab, this.preferencesTab];
  }
}
