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
import { featuredResources, resources } from 'src/model/core/types';

import { BasePage } from './base-page';
import { SettingsCreateGeminiPage } from './settings-create-gemini-page';
import { SettingsCreateOpenAIPage } from './settings-create-openai-page';

export class SettingsResourcesPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async waitForLoad(): Promise<void> {
    await expect(this.getResourceRegion(featuredResources[0])).toBeVisible();
  }

  getResourceRegion(resourceId: string): Locator {
    return this.page.getByRole('region', { name: resourceId });
  }

  getResourceCreateButton(displayName: string): Locator {
    return this.page.getByRole('button', { name: `Create new ${displayName}` });
  }

  async openCreateGeminiPage(): Promise<SettingsCreateGeminiPage> {
    return this.openTab(this.getResourceCreateButton(resources.gemini.displayName), SettingsCreateGeminiPage);
  }

  async openCreateOpenAIPage(): Promise<SettingsCreateOpenAIPage> {
    return this.openTab(this.getResourceCreateButton(resources.openai.displayName), SettingsCreateOpenAIPage);
  }

  getCreatedResourcesFor(resourceId: keyof typeof resources): Locator {
    const resourceRegion = this.getResourceRegion(resourceId);
    return resourceRegion.getByRole('region').filter({ hasText: '(Inference)' });
  }

  getCreatedResourceFor(resourceId: keyof typeof resources): Locator {
    return this.getCreatedResourcesFor(resourceId).first();
  }

  getDeleteButtonForCreatedResource(resource: Locator): Locator {
    return resource.getByRole('button', { name: 'Delete' });
  }

  async deleteCreatedResourceFor(resourceId: keyof typeof resources): Promise<void> {
    const resource = this.getCreatedResourceFor(resourceId);
    const deleteButton = this.getDeleteButtonForCreatedResource(resource);
    await deleteButton.click();
  }
}
