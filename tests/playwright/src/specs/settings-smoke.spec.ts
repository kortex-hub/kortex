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
import { SettingsPage } from '../model/navigation/pages/settings-page';
import { preferenceOptions } from '../model/navigation/pages/settings-preferences-tab-page';
import { proxyConfigurations } from '../model/navigation/pages/settings-proxy-tab-page';
import { featuredResources, resourcesWithCreateButton } from '../model/navigation/pages/settings-resources-tab-page';

let navigationBar: NavigationBar;
let settingsPage: SettingsPage;

test.beforeEach(async ({ page }) => {
  navigationBar = new NavigationBar(page);
  settingsPage = new SettingsPage(page);
  // Wait for navigation bar to be ready before clicking
  await expect(navigationBar.navigationLocator).toBeVisible({ timeout: 30_000 });
  await navigationBar.settingsLink.click();
});

test.describe('Settings page navigation', { tag: '@smoke' }, () => {
  test('[TC-01] All settings tabs are visible', async () => {
    for (const tab of settingsPage.getAllTabs()) {
      await expect(tab).toBeVisible();
    }
  });

  test('[TC-02] Resources tab shows all providers with create buttons', async () => {
    const resourcesPage = await settingsPage.openResources();
    for (const resourceId of featuredResources) {
      await expect(resourcesPage.getResourceRegion(resourceId)).toBeVisible();
    }
    for (const displayName of resourcesWithCreateButton) {
      const createButton = resourcesPage.getResourceCreateButton(displayName);
      await expect(createButton).toBeVisible();
      await expect(createButton).toBeEnabled();
    }
  });

  test('[TC-03] CLI tab shows goose CLI tool', async () => {
    const cliPage = await settingsPage.openCli();
    await expect(cliPage.toolName).toBeVisible();
    await expect(cliPage.toolName).toHaveText('goose');
  });

  test('[TC-04] Proxy tab configurations', async () => {
    const proxyPage = await settingsPage.openProxy();
    await proxyPage.verifyProxyConfigurationOptions();
    for (const field of proxyPage.getProxyFields()) {
      await expect(field).toBeVisible();
    }
    for (const config of proxyConfigurations) {
      await proxyPage.selectProxyConfigurationAndVerifyFields(config.option, config.editable);
    }
  });

  test('[TC-05] Preferences submenu items are visible and can be interacted with', async () => {
    const preferencesPage = await settingsPage.openPreferences();
    for (const option of preferenceOptions()) {
      await preferencesPage.selectPreference(option);
    }
  });

  test('[TC-06] Preferences search filters options correctly', async () => {
    const preferencesPage = await settingsPage.openPreferences();
    for (const option of preferenceOptions()) {
      await preferencesPage.searchPreferences(option);
      await expect(preferencesPage.getPreferenceContent(option)).toBeVisible();
      await preferencesPage.clearSearch();
    }
  });
});
