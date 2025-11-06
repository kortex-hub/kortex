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
import {
  featuredResources,
  preferenceOptions,
  proxyConfigurations,
  resourcesWithCreateButton,
} from 'src/model/core/types';

import { expect, test } from '../fixtures/electron-app';
import { waitForNavigationReady } from '../utils/app-ready';

test.describe('Settings page navigation', { tag: '@smoke' }, () => {
  test.beforeEach(async ({ page, navigationBar }) => {
    await waitForNavigationReady(page);
    await navigationBar.navigateToSettingsPage();
  });

  test('[SET-01] All settings tabs are visible', async ({ settingsPage }) => {
    const tabs = settingsPage.getAllTabs();
    const expectedTabCount = 4; // Resources, CLI, Proxy, Preferences

    expect(tabs).toHaveLength(expectedTabCount);

    for (const tab of tabs) {
      await expect(tab).toBeVisible();
    }
  });

  test('[SET-02] Resources tab shows all providers with create buttons', async ({ settingsPage }) => {
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

  test('[SET-03] CLI tab shows goose CLI tool', async ({ settingsPage }) => {
    const cliPage = await settingsPage.openCli();

    await expect(cliPage.toolName).toBeVisible();
    await expect(cliPage.toolName).toHaveText('goose');
  });

  test('[SET-04] Proxy tab configurations and fields', async ({ settingsPage }) => {
    const proxyPage = await settingsPage.openProxy();
    await proxyPage.verifyProxyConfigurationOptions();
    const proxyFields = proxyPage.getProxyFields();
    expect(proxyFields.length).toBeGreaterThan(0);

    for (const field of proxyFields) {
      await expect(field).toBeVisible();
    }

    for (const config of proxyConfigurations) {
      await proxyPage.selectProxyConfigurationAndVerifyFields(config.option, config.editable);
    }
  });

  test('[SET-05] Preferences submenu items are visible and can be interacted with', async ({ settingsPage }) => {
    const preferencesPage = await settingsPage.openPreferences();
    const options = preferenceOptions();
    expect(options.length).toBeGreaterThan(0);

    for (const option of options) {
      await preferencesPage.selectPreference(option);
      await expect(preferencesPage.getPreferenceContent(option)).toBeVisible();
    }
  });

  test('[SET-06] Preferences search filters options correctly', async ({ settingsPage }) => {
    const preferencesPage = await settingsPage.openPreferences();
    const options = preferenceOptions();
    expect(options.length).toBeGreaterThan(0);

    for (const option of options) {
      await preferencesPage.searchPreferences(option);
      await expect(preferencesPage.getPreferenceContent(option)).toBeVisible();
      await preferencesPage.clearSearch();
    }
  });
});
