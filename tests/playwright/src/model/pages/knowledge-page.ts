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

import { handleDialogIfPresent } from '/@/utils/app-ready';

import { BaseTablePage } from './base-table-page';
import { KnowledgeCreatePage } from './knowledge-create-page';
import { KnowledgeDetailsPage } from './knowledge-details-page';

export class KnowledgePage extends BaseTablePage {
  readonly header: Locator;
  readonly heading: Locator;
  readonly noEnvironmentsMessage: Locator;
  readonly newKnowledgeBaseButton: Locator;

  constructor(page: Page) {
    super(page, 'rag-environments');
    this.header = this.page.getByRole('region', { name: 'header' });
    this.heading = this.header.getByRole('heading', { name: 'Knowledge Bases' });
    this.noEnvironmentsMessage = this.content.getByText('No knowledge databases are currently configured.');
    this.newKnowledgeBaseButton = this.header.getByRole('button', { name: 'New Knowledge Base' });
  }

  async waitForLoad(): Promise<void> {
    await expect(this.heading).toBeVisible({ timeout: 15_000 });
  }

  async openCreatePage(): Promise<KnowledgeCreatePage> {
    await this.waitForLoad();
    await expect(this.newKnowledgeBaseButton).toBeEnabled();
    await this.newKnowledgeBaseButton.click();

    const createPage = new KnowledgeCreatePage(this.page);
    await createPage.waitForLoad();
    return createPage;
  }

  async createEnvironment(name: string, vectorStoreName: string, embeddingModelName: string): Promise<void> {
    const createPage = await this.openCreatePage();
    await createPage.fillAndSubmit(name, vectorStoreName, embeddingModelName);
    await this.ensureRowExists(name);
  }

  async deleteEnvironment(name: string): Promise<void> {
    await this.waitForLoad();
    const row = await this.getRowLocatorByName(name);
    await row.getByRole('button', { name: 'Delete' }).click();
    await handleDialogIfPresent(this.page);
    await this.ensureRowDoesNotExist(name);
  }

  async openEnvironmentDetails(name: string, exact = true): Promise<KnowledgeDetailsPage> {
    await this.waitForLoad();
    const row = await this.getRowLocatorByName(name, exact);
    const nameButton = row.getByRole('button', { name });
    await expect(nameButton).toBeVisible();
    await nameButton.click();
    return new KnowledgeDetailsPage(this.page, name);
  }
}
