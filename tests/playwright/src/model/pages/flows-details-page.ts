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
import { FlowsPage } from './flows-page';

export class FlowDetailsPage extends BasePage {
  readonly flowName: string;
  readonly header: Locator;
  readonly heading: Locator;
  readonly pageTabsRegion: Locator;
  readonly tabContentRegion: Locator;
  readonly controlActionsButtonGroup: Locator;
  readonly runFlowButton: Locator;
  readonly deleteFlowButton: Locator;
  readonly closeDetailsPageButton: Locator;
  readonly summaryTabLink: Locator;
  readonly sourceTabLink: Locator;
  readonly kubernetesTabLink: Locator;
  readonly runTabLink: Locator;

  constructor(page: Page, name: string) {
    super(page);
    this.flowName = name;
    this.header = this.page.getByRole('region', { name: 'header' });
    this.heading = this.header.getByRole('heading', { name: this.flowName });
    this.pageTabsRegion = this.page.getByRole('region', { name: 'Tabs' });
    this.tabContentRegion = this.page.getByRole('region', { name: 'Tab Content' });
    this.controlActionsButtonGroup = this.header.getByRole('group', { name: 'Control Actions' });
    this.runFlowButton = this.controlActionsButtonGroup.getByRole('button', { name: 'Run this recipe' });
    this.deleteFlowButton = this.controlActionsButtonGroup.getByRole('button', { name: 'Delete' });
    this.summaryTabLink = this.pageTabsRegion.getByRole('link', { name: 'Summary' });
    this.sourceTabLink = this.pageTabsRegion.getByRole('link', { name: 'Source' });
    this.kubernetesTabLink = this.pageTabsRegion.getByRole('link', { name: 'Kubernetes' });
    this.runTabLink = this.pageTabsRegion.getByRole('link', { name: 'Run' });
    this.closeDetailsPageButton = this.header.getByRole('button', { name: 'Close' });
  }

  async waitForLoad(): Promise<void> {
    await expect(this.heading).toContainText(this.flowName);
  }

  async runFlow(): Promise<void> {
    await expect(this.runFlowButton).toBeEnabled();
    await this.runFlowButton.click();
  }

  async deleteFlow(): Promise<FlowsPage> {
    await expect(this.deleteFlowButton).toBeEnabled();
    await this.deleteFlowButton.click();

    const confirmDeleteDialog = this.page.getByRole('dialog', { name: 'Confirmation' });
    const confirmDeleteButton = confirmDeleteDialog.getByRole('button', { name: 'Yes' });
    await expect(confirmDeleteButton).toBeEnabled();
    await confirmDeleteButton.click();

    return new FlowsPage(this.page);
  }

  async closeDetailsPage(): Promise<FlowsPage> {
    await expect(this.closeDetailsPageButton).toBeEnabled();
    await this.closeDetailsPageButton.click();

    return new FlowsPage(this.page);
  }
}
