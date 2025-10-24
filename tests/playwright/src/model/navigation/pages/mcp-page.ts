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
import { McpEditRegistriesTabPage } from './mcp-edit-registries-tab-page';
import { McpInstallTabPage } from './mcp-install-tab-page';

export class McpPage extends BasePage {
  readonly searchMcpServersField: Locator;
  readonly editRegistriesTabButton: Locator;
  readonly installTabButton: Locator;
  readonly readyTabButton: Locator;

  constructor(page: Page) {
    super(page);
    this.searchMcpServersField = page.getByLabel('search MCP servers');
    this.editRegistriesTabButton = page.getByRole('button', { name: 'Edit registries' });
    this.installTabButton = page.getByRole('button', { name: 'Install' });
    this.readyTabButton = page.getByRole('button', { name: 'Ready' });
  }

  async waitForLoad(): Promise<void> {
    await expect(this.searchMcpServersField).toBeVisible();
  }

  async openEditRegistriesTab(): Promise<McpEditRegistriesTabPage> {
    await expect(this.editRegistriesTabButton).toBeEnabled();
    await this.editRegistriesTabButton.click();
    const editRegistriesTabPage = new McpEditRegistriesTabPage(this.page);
    await editRegistriesTabPage.waitForLoad();
    return editRegistriesTabPage;
  }

  async openInstallTab(): Promise<McpInstallTabPage> {
    await expect(this.installTabButton).toBeEnabled();
    await this.installTabButton.click();
    const installTabPage = new McpInstallTabPage(this.page);
    await installTabPage.waitForLoad();
    return installTabPage;
  }
}
