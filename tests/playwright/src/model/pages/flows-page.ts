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
import type { FlowParameters } from 'src/model/core/types';
import { handleDialogIfPresent } from 'src/utils/app-ready';

import { BaseTablePage } from './base-table-page';
import { FlowsCreatePage } from './flows-create-page';
import { FlowDetailsPage } from './flows-details-page';

export class FlowsPage extends BaseTablePage {
  readonly header: Locator;
  readonly heading: Locator;
  readonly additionalActionsButtonGroup: Locator;
  readonly createFlowButton: Locator;
  readonly refreshButton: Locator;
  readonly createFlowButtonFromContentRegion: Locator;
  readonly noCurrentFlowExistsMessage: Locator;

  constructor(page: Page) {
    super(page, 'flows');
    this.header = this.page.getByRole('region', { name: 'header' });
    this.heading = this.header.getByRole('heading', { name: 'Flows' });
    this.additionalActionsButtonGroup = this.header.getByRole('group', { name: 'additionalActions' });
    this.createFlowButton = this.additionalActionsButtonGroup.getByRole('button', { name: 'Create' });
    this.refreshButton = this.additionalActionsButtonGroup.getByRole('button', { name: 'Refresh' });

    this.createFlowButtonFromContentRegion = this.content.getByRole('button', { name: 'Create' });
    this.noCurrentFlowExistsMessage = this.content.getByText('No flow');
  }

  async waitForLoad(): Promise<void> {
    await expect(this.heading).toBeVisible({ timeout: 15_000 });
  }

  async runFlowByName(name: string, exact = false): Promise<FlowDetailsPage> {
    await this.waitForLoad();
    const row = await this.getRowLocatorByName(name, exact);

    const runButton = await this.getRunButtonForRow(row);
    await expect(runButton).toBeEnabled();
    await runButton.click();

    return new FlowDetailsPage(this.page, name);
  }

  async deleteFlowByName(name: string, exact = false): Promise<void> {
    await this.waitForLoad();
    const row = await this.getRowLocatorByName(name, exact);

    const deleteButton = await this.getDeleteButtonForRow(row);
    await expect(deleteButton).toBeEnabled();
    await deleteButton.click();
    await handleDialogIfPresent(this.page);
  }

  async deleteFirstFlow(): Promise<void> {
    await this.waitForLoad();
    const rowCount = await this.countRowsFromTable();
    if (rowCount === 0) {
      return;
    }

    // Index 0 is the header row, so index 1 is the first data row
    const row = await this.getRowLocatorByIndex(1);

    const deleteButton = await this.getDeleteButtonForRow(row);
    await expect(deleteButton).toBeEnabled();
    await deleteButton.click();
    await handleDialogIfPresent(this.page);
  }

  async createFlow(
    name: string,
    { description, model, mcpServer, prompt, instruction }: FlowParameters = {},
  ): Promise<FlowDetailsPage> {
    await this.waitForLoad();

    await expect(this.createFlowButton).toBeEnabled();
    await this.createFlowButton.click();

    const flowCreatePage = new FlowsCreatePage(this.page);
    return flowCreatePage.createNewFlow(name, { description, model, mcpServer, prompt, instruction });
  }

  async openFlowDetailsPageByName(name: string, exact = false): Promise<FlowDetailsPage> {
    await this.waitForLoad();
    const button = await this.createFlowsDetailsPageButton(name, exact);

    await expect(button).toBeVisible();
    await button.click();

    return new FlowDetailsPage(this.page, name);
  }

  async checkIfFlowsPageIsEmpty(): Promise<boolean> {
    await this.waitForLoad();
    return (await this.noCurrentFlowExistsMessage.count()) > 0;
  }

  private async createFlowsDetailsPageButton(name: string, exact = false): Promise<Locator> {
    const row = await this.getRowLocatorByName(name, exact);

    return row.getByRole('button').first();
  }

  private async getRowButtonByLabel(row: Locator, label: string): Promise<Locator> {
    return row.getByLabel(label, { exact: true }).first();
  }

  private async getDeleteButtonForRow(row: Locator): Promise<Locator> {
    return this.getRowButtonByLabel(row, 'Delete');
  }

  private async getRunButtonForRow(row: Locator): Promise<Locator> {
    return this.getRowButtonByLabel(row, 'Run this recipe');
  }
}
