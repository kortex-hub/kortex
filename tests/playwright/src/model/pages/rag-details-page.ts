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

import { type ElectronApplication, expect, type Locator, type Page } from '@playwright/test';
import { handleDialogIfPresent } from 'src/utils/app-ready';

import { BasePage } from './base-page';
import { RagPage } from './rag-page';

export class RagDetailsPage extends BasePage {
  readonly environmentName: string;
  readonly header: Locator;
  readonly heading: Locator;
  readonly pageTabsRegion: Locator;
  readonly tabContentRegion: Locator;
  readonly summaryTabLink: Locator;
  readonly sourcesTabLink: Locator;
  readonly vectorStoreTabLink: Locator;
  readonly chunkerTabLink: Locator;
  readonly uploadedFilesHeader: Locator;
  readonly uploadButton: Locator;
  readonly closeDetailsPageButton: Locator;
  readonly deleteButton: Locator;

  constructor(page: Page, name: string) {
    super(page);
    this.environmentName = name;
    this.header = this.page.getByRole('region', { name: 'header' });
    this.heading = this.header.getByRole('heading', { name: this.environmentName });
    this.pageTabsRegion = this.page.getByRole('region', { name: 'Tabs' });
    this.tabContentRegion = this.page.getByRole('region', { name: 'Tab Content' });
    this.summaryTabLink = this.pageTabsRegion.getByRole('link', { name: 'Summary' });
    this.sourcesTabLink = this.pageTabsRegion.getByRole('link', { name: 'Sources' });
    this.vectorStoreTabLink = this.pageTabsRegion.getByRole('link', { name: 'VectorStore' });
    this.chunkerTabLink = this.pageTabsRegion.getByRole('link', { name: 'Chunker' });
    this.uploadedFilesHeader = this.tabContentRegion.getByRole('heading', { name: 'Uploaded Files' });
    this.uploadButton = this.tabContentRegion.getByRole('button', { name: /click to upload/i });
    this.closeDetailsPageButton = this.header.getByRole('button', { name: 'Close' });
    this.deleteButton = this.header.getByRole('button', { name: 'Delete environment' });
  }

  async waitForLoad(): Promise<void> {
    await expect(this.heading).toBeVisible({ timeout: 15_000 });
    await expect(this.pageTabsRegion).toBeVisible();
  }

  async switchToSummaryTab(): Promise<void> {
    await this.switchTab(this.summaryTabLink);
  }

  async switchToSourcesTab(): Promise<void> {
    await this.switchTab(this.sourcesTabLink);
  }

  async switchToVectorStoreTab(): Promise<void> {
    await this.switchTab(this.vectorStoreTabLink);
  }

  async switchToChunkerTab(): Promise<void> {
    await this.switchTab(this.chunkerTabLink);
  }

  getUploadedFile(fileName: string): Locator {
    return this.tabContentRegion.getByRole('heading', { name: fileName });
  }

  getUploadedFileRow(fileName: string): Locator {
    return this.tabContentRegion
      .getByLabel('source file')
      .filter({ has: this.page.getByRole('heading', { name: fileName }) });
  }

  async uploadFile(absoluteFilePath: string, electronApp: ElectronApplication): Promise<void> {
    await electronApp.evaluate(({ dialog }, filePath: string) => {
      dialog.showOpenDialog = (() =>
        Promise.resolve({ canceled: false, filePaths: [filePath] })) as typeof dialog.showOpenDialog;
    }, absoluteFilePath);
    try {
      await expect(this.uploadButton).toBeVisible();
      await this.uploadButton.click();
    } finally {
      await electronApp.evaluate(({ dialog }) => {
        delete (dialog as unknown as Record<string, unknown>).showOpenDialog;
      });
    }
  }

  getInfoValue(label: string): Locator {
    return this.tabContentRegion.getByLabel(label, { exact: true }).getByTestId('info-value');
  }

  getInfoRow(label: string): Locator {
    return this.tabContentRegion.getByLabel(label, { exact: true });
  }

  async deleteEnvironment(): Promise<RagPage> {
    await expect(this.deleteButton).toBeEnabled();
    await this.deleteButton.click();
    await handleDialogIfPresent(this.page);
    return this.closeDetailsPage();
  }

  async closeDetailsPage(): Promise<RagPage> {
    await expect(this.closeDetailsPageButton).toBeEnabled();
    await this.closeDetailsPageButton.click();
    return new RagPage(this.page);
  }

  private async switchTab(tabLink: Locator): Promise<void> {
    await expect(tabLink).toBeVisible();
    await tabLink.click();
  }
}
