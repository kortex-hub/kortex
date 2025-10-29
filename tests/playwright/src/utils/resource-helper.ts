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
import { expect, type Page } from '@playwright/test';
import type { SettingsResourceId } from 'src/model/core/types';

import { NavigationBar } from '../model/navigation/navigation';
import { SettingsPage } from '../model/pages/settings-page';
import type { SettingsResourcesPage } from '../model/pages/settings-resources-tab-page';
import { waitForNavigationReady } from './app-ready';

export interface ResourceConfig {
  readonly envVarName: string;
  readonly resourceId: SettingsResourceId;
}

export const PROVIDERS = {
  gemini: {
    envVarName: 'GEMINI_API_KEY',
    resourceId: 'gemini',
  },
  openai: {
    envVarName: 'OPENAI_API_KEY',
    resourceId: 'openai',
  },
  'openshift-ai': {
    envVarName: 'OPENSHIFT_AI_TOKEN',
    resourceId: 'openshiftai',
  },
} as const satisfies Record<string, ResourceConfig>;

export type ResourceId = keyof typeof PROVIDERS;

async function navigateToResourcesPage(page: Page): Promise<SettingsResourcesPage> {
  await waitForNavigationReady(page);
  const navigationBar = new NavigationBar(page);
  await navigationBar.settingsLink.click();
  const settingsPage = new SettingsPage(page);
  return await settingsPage.openResources();
}

export async function createResource(page: Page, providerId: ResourceId): Promise<void> {
  const provider = PROVIDERS[providerId];
  const credentials = process.env[provider.envVarName];
  if (!credentials) {
    throw new Error(`${provider.envVarName} environment variable is not set`);
  }
  const resourcesPage = await navigateToResourcesPage(page);

  if ((await resourcesPage.getCreatedResourceFor(provider.resourceId).count()) > 0) {
    // Resource already exists
    return;
  }

  switch (providerId) {
    case 'gemini': {
      const createGeminiPage = await resourcesPage.openCreateGeminiPage();
      await createGeminiPage.createAndGoBack(credentials);
      break;
    }
    case 'openai':
      throw new Error('OpenAI resource creation not yet implemented');
    case 'openshift-ai':
      throw new Error('OpenShift AI resource creation not yet implemented');
    default:
      throw new Error(`Unknown provider: ${providerId}`);
  }
  await resourcesPage.waitForLoad();
  const resource = resourcesPage.getCreatedResourceFor(provider.resourceId);
  await expect(resource).toBeVisible();
}

export async function deleteResource(page: Page, providerId: ResourceId): Promise<void> {
  const provider = PROVIDERS[providerId];
  const resourcesPage = await navigateToResourcesPage(page);
  await resourcesPage.waitForLoad();
  await resourcesPage.deleteCreatedResourceFor(provider.resourceId);
  const resource = resourcesPage.getCreatedResourceFor(provider.resourceId);
  await expect(resource).not.toBeVisible();
}

export function getProviderCredentials(providerId: ResourceId): string | undefined {
  const provider = PROVIDERS[providerId];
  return process.env[provider.envVarName];
}

export function hasApiKey(providerId: ResourceId): boolean {
  return !!getProviderCredentials(providerId);
}
