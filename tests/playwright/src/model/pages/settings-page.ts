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

import type { ResourceId } from '../core/types';
import { PROVIDERS, TIMEOUTS } from '../core/types';
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
  private readonly tabs: Locator[];

  constructor(page: Page) {
    super(page);
    this.resourcesTab = page.getByRole('link', { name: 'Resources' });
    this.cliTab = page.getByRole('link', { name: 'CLI' });
    this.proxyTab = page.getByRole('link', { name: 'Proxy' });
    this.preferencesTab = page.getByRole('link', { name: 'Preferences' });
    this.tabs = [this.resourcesTab, this.cliTab, this.proxyTab, this.preferencesTab];
  }

  async isCurrentPage(): Promise<boolean> {
    return this.resourcesTab.isVisible();
  }

  async waitForLoad(): Promise<void> {
    await expect(this.resourcesTab).toBeVisible({ timeout: TIMEOUTS.SHORT });
    await expect(this.cliTab).toBeVisible({ timeout: TIMEOUTS.SHORT });
    await expect(this.proxyTab).toBeVisible({ timeout: TIMEOUTS.SHORT });
    await expect(this.preferencesTab).toBeVisible({ timeout: TIMEOUTS.SHORT });
  }

  async openResources(): Promise<SettingsResourcesPage> {
    return this.openTab(this.resourcesTab, SettingsResourcesPage);
  }

  async openCli(): Promise<SettingsCliPage> {
    return this.openTab(this.cliTab, SettingsCliPage);
  }

  async openProxy(): Promise<SettingsProxyPage> {
    return this.openTab(this.proxyTab, SettingsProxyPage);
  }

  async openPreferences(): Promise<SettingsPreferencesPage> {
    return this.openTab(this.preferencesTab, SettingsPreferencesPage);
  }

  getAllTabs(): Locator[] {
    return this.tabs;
  }

  async createResource(providerId: ResourceId, value: string): Promise<void> {
    const provider = PROVIDERS[providerId];
    const connectionType = 'connectionType' in provider ? provider.connectionType : 'inference';
    const resourcesPage = await this.openResources();

    if ((await resourcesPage.getCreatedConnectionFor(provider.resourceId, connectionType).count()) > 0) {
      console.log(`Resource ${providerId} already exists, skipping...`);
      return;
    }

    switch (providerId) {
      case 'gemini': {
        const createGeminiPage = await resourcesPage.openCreateGeminiPage();
        await createGeminiPage.createAndGoBack(value);
        break;
      }
      case 'openai': {
        const createOpenAIPage = await resourcesPage.openCreateOpenAIPage();
        await createOpenAIPage.createAndGoBack(PROVIDERS.openai.baseURL, value);
        break;
      }
      case 'milvus': {
        const createMilvusPage = await resourcesPage.openCreateMilvusPage();
        await createMilvusPage.createAndGoBack(value);
        break;
      }
      case 'openshift-ai':
        throw new Error('OpenShift AI resource creation not yet implemented');
      default:
        throw new Error(`Unknown provider: ${providerId}`);
    }

    await resourcesPage.waitForLoad();
    const resource = resourcesPage.getCreatedConnectionFor(provider.resourceId, connectionType);
    await expect(resource).toBeVisible({ timeout: TIMEOUTS.DEFAULT });
  }

  async deleteResource(providerId: ResourceId): Promise<void> {
    const provider = PROVIDERS[providerId];
    const connectionType = 'connectionType' in provider ? provider.connectionType : 'inference';
    const resourcesPage = await this.openResources();

    await resourcesPage.waitForLoad();
    await resourcesPage.deleteCreatedConnectionFor(provider.resourceId, connectionType);

    const resource = resourcesPage.getCreatedConnectionFor(provider.resourceId, connectionType);
    await expect(resource).not.toBeVisible();
  }

  async installGoose(): Promise<void> {
    const cliPage = await this.openCli();

    if (await cliPage.isGooseVersionDetected()) {
      console.log('Goose is already installed, skipping...');
      return;
    }

    await cliPage.installGoose();
  }
}
