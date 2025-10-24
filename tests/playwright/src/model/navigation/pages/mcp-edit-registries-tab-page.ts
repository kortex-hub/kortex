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

import { McpBaseTabPage } from './mcp-base-tab-page';

export class McpEditRegistriesTabPage extends McpBaseTabPage {
  readonly addMcpRegistryButton: Locator;
  readonly addMcpRegistryDialog: Locator;

  constructor(page: Page) {
    super(page, 'Registries');
    this.addMcpRegistryButton = page.getByRole('button', { name: 'Add MCP registry' });
    this.addMcpRegistryDialog = page.getByRole('dialog', { name: 'Add MCP Registry' });
  }

  async waitForLoad(): Promise<void> {
    await expect(this.table).toBeVisible();
  }

  async removeRegistry(name: string): Promise<void> {
    const locator = await this.getTableRow(name);
    if (locator === undefined) {
      console.log(`MCP Registry '${name}' does not exist, skipping...`);
    } else {
      const removeButton = locator.getByRole('button', { name: 'Remove' });
      await expect(removeButton).toBeEnabled();
      await removeButton.click();
    }
  }

  async verifyRegistryExists(url: string, timeout?: number): Promise<void> {
    await expect.poll(async () => await this.getTableRow(url), { timeout: timeout }).toBeTruthy();
  }

  async verifyRegistryIsRemoved(url: string, timeout?: number): Promise<void> {
    await expect.poll(async () => await this.getTableRow(url), { timeout: timeout }).toBeFalsy();
  }

  async addNewRegistry(registryUrl: string): Promise<void> {
    await expect(this.addMcpRegistryButton).toBeEnabled();
    await this.addMcpRegistryButton.click();
    await this.handleAddMcpRegistryDialog(registryUrl);
  }

  private async handleAddMcpRegistryDialog(registryUrl: string): Promise<void> {
    await expect(this.addMcpRegistryDialog).toBeVisible();
    const addButton = this.addMcpRegistryDialog.getByRole('button', { name: 'Add' });
    const registryUrlInput = this.addMcpRegistryDialog.getByPlaceholder('Enter the URL of a registry');

    await expect(addButton).not.toBeEnabled();
    await expect(registryUrlInput).toBeEmpty();
    await registryUrlInput.fill(registryUrl);
    await expect(registryUrlInput).toHaveValue(registryUrl);
    await expect(addButton).toBeEnabled();
    await addButton.click();
  }
}
