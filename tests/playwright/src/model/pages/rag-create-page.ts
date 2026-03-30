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
import { TIMEOUTS } from 'src/model/core/types';

import { BasePage } from './base-page';

export class RagCreatePage extends BasePage {
  readonly modal: Locator;
  readonly heading: Locator;
  readonly nameInputField: Locator;
  readonly createButton: Locator;
  readonly cancelButton: Locator;

  constructor(page: Page) {
    super(page);
    this.modal = this.page.getByLabel('create knowledge environment');
    this.heading = this.modal.getByRole('heading', { name: 'New Knowledge Environment' });
    this.nameInputField = this.modal.getByLabel('Environment Name');
    this.createButton = this.modal.getByRole('button', { name: 'Create Environment' });
    this.cancelButton = this.modal.getByRole('button', { name: 'Cancel' });
  }

  async waitForLoad(): Promise<void> {
    await expect(this.heading).toBeVisible({ timeout: 15_000 });
    await expect(this.nameInputField).toBeVisible();
    await expect(this.createButton).toBeVisible();
  }

  getVectorStoreTile(name: string): Locator {
    return this.modal.getByRole('group', { name: 'Vector Store' }).getByRole('button').filter({ hasText: name });
  }

  getEmbeddingModelTile(name: string): Locator {
    return this.modal.getByRole('group', { name: 'Embedding Model' }).getByRole('button').filter({ hasText: name });
  }

  async fillName(name: string): Promise<void> {
    await this.nameInputField.fill(name);
    await expect(this.nameInputField).toHaveValue(name);
  }

  async selectVectorStore(name: string): Promise<void> {
    const tile = this.getVectorStoreTile(name);
    await expect(tile).toBeVisible({ timeout: TIMEOUTS.STANDARD });
    await tile.click();
  }

  async selectEmbeddingModel(name: string): Promise<void> {
    const tile = this.getEmbeddingModelTile(name);
    await expect(tile).toBeVisible({ timeout: TIMEOUTS.STANDARD });
    await tile.click();
  }

  async submitForm(): Promise<void> {
    await expect(this.createButton).toBeEnabled({ timeout: TIMEOUTS.SHORT });
    await this.createButton.click();
    await expect(this.modal).not.toBeVisible({ timeout: TIMEOUTS.STANDARD });
  }

  async fillAndSubmit(name: string, vectorStoreName: string, embeddingModelName: string): Promise<void> {
    await this.waitForLoad();
    await this.fillName(name);
    await this.selectVectorStore(vectorStoreName);
    await this.selectEmbeddingModel(embeddingModelName);
    await this.submitForm();
  }
}
