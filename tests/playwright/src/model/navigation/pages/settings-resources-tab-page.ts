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

export const resources = {
  openshiftai: { displayName: 'OpenShift AI', hasCreateButton: true },
  openai: { displayName: 'OpenAI', hasCreateButton: true },
  goose: { displayName: 'goose', hasCreateButton: false },
  gemini: { displayName: 'Gemini', hasCreateButton: true },
} as const;

export const featuredResources = Object.keys(resources) as (keyof typeof resources)[];
export const resourcesWithCreateButton = Object.values(resources)
  .filter(r => r.hasCreateButton)
  .map(r => r.displayName);

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
}
