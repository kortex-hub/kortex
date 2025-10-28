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
import type { SettingsPage } from '../model/navigation/pages/settings-page';
import { waitForNavigationReady } from '../utils/app-ready';

let settingsPage: SettingsPage;

test.beforeEach(async ({ page, navigationBar }) => {
  await waitForNavigationReady(page);
  settingsPage = await navigationBar.navigateToSettingsPage();
});

test.describe('Settings page navigation', { tag: '@smoke' }, () => {
  test('[SET-01] All settings tabs are visible', async () => {
    for (const tab of settingsPage.getAllTabs()) {
      await expect(tab).toBeVisible();
    }
  });

  test('[SET-02] Resources tab shows all providers with create buttons', async () => {
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

  test('[SET-03] CLI tab shows goose CLI tool', async () => {
    const cliPage = await settingsPage.openCli();
    await expect(cliPage.toolName).toBeVisible();
    await expect(cliPage.toolName).toHaveText('goose');
  });

  test('[SET-04] Proxy tab configurations', async () => {
    const proxyPage = await settingsPage.openProxy();
    await proxyPage.verifyProxyConfigurationOptions();
    for (const field of proxyPage.getProxyFields()) {
      await expect(field).toBeVisible();
    }
    for (const config of proxyConfigurations) {
      await proxyPage.selectProxyConfigurationAndVerifyFields(config.option, config.editable);
    }
  });

  test('[SET-05] Preferences submenu items are visible and can be interacted with', async () => {
    const preferencesPage = await settingsPage.openPreferences();
    for (const option of preferenceOptions()) {
      await preferencesPage.selectPreference(option);
    }
  });

  test('[SET-06] Preferences search filters options correctly', async () => {
    const preferencesPage = await settingsPage.openPreferences();
    for (const option of preferenceOptions()) {
      await preferencesPage.searchPreferences(option);
      await expect(preferencesPage.getPreferenceContent(option)).toBeVisible();
      await preferencesPage.clearSearch();
    }
  });

  test('[SET-07] Create a new Gemini resource', async () => {
    const resourceId = 'gemini';
    if (process.env.CI) {
      test.skip(true, 'Skipping Gemini resource creation test on CI');
      return;
    }
    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      test.skip(true, 'GEMINI_API_KEY environment variable is not set');
      return;
    }
    const resourcesPage = await settingsPage.openResources();
    const createGeminiPage = await resourcesPage.openCreateGeminiPage();
    await createGeminiPage.createAndGoBack(geminiApiKey);
    await resourcesPage.waitForLoad();
    const geminiResource = resourcesPage.getCreatedResourceFor(resourceId);
    await expect(geminiResource).toBeVisible({ timeout: 5_000 });
    await resourcesPage.deleteCreatedResourceFor(resourceId);
    await expect(geminiResource).not.toBeVisible();
  });
});
