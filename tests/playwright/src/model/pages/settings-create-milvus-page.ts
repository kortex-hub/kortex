/**********************************************************************
 * Copyright (C) 2026 Red Hat, Inc.
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

import { TIMEOUTS } from '../core/types';
import { BasePage } from './base-page';

export class SettingsCreateMilvusPage extends BasePage {
  readonly nameInput: Locator;
  readonly createButton: Locator;
  readonly goBackToResourcesButton: Locator;

  constructor(page: Page) {
    super(page);
    this.nameInput = page.getByLabel('Name for the Milvus connection');
    this.createButton = page.getByRole('button', { name: 'Create' });
    this.goBackToResourcesButton = page.getByRole('button', { name: 'Go back to resources' });
  }

  async waitForLoad(): Promise<void> {
    await expect(this.nameInput).toBeVisible();
    await expect(this.createButton).toBeVisible();
  }

  async create(connectionName: string): Promise<void> {
    await this.nameInput.fill(connectionName);
    await expect(this.nameInput).toHaveValue(connectionName);
    await expect(this.createButton).toBeEnabled();
    await this.createButton.click();
  }

  async goBackToResources(): Promise<void> {
    await expect(this.goBackToResourcesButton).toBeVisible({ timeout: TIMEOUTS.DEFAULT });
    await this.goBackToResourcesButton.click();
  }

  async createAndGoBack(connectionName: string): Promise<void> {
    await this.create(connectionName);
    await this.goBackToResources();
  }
}
