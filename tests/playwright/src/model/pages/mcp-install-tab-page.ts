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

import { BaseTablePage } from './base-table-page';

export class McpInstallTabPage extends BaseTablePage {
  readonly noMcpServersAvailableHeading: Locator;

  constructor(page: Page) {
    super(page, 'mcpServer');
    this.noMcpServersAvailableHeading = this.table.getByRole('heading', { name: 'No MCP servers available' });
  }

  async waitForLoad(): Promise<void> {
    await expect(this.table).toBeVisible();
  }

  async verifyServerCountIncreased(initialServerCount: number, timeout = 10_000): Promise<void> {
    await expect
      .poll(async () => await this.countRowsFromTable(), { timeout: timeout })
      .toBeGreaterThan(initialServerCount);
  }

  async verifyServerCountIsRestored(initialServerCount: number, timeout = 10_000): Promise<void> {
    await expect.poll(async () => await this.countRowsFromTable(), { timeout: timeout }).toBe(initialServerCount);
  }

  async verifyInstallTabIsNotEmpty(timeout = 10_000): Promise<void> {
    await expect(this.noMcpServersAvailableHeading).not.toBeVisible({ timeout: timeout });
  }

  findServer(serverName: string): Locator {
    return this.table.getByRole('row').filter({ hasText: serverName });
  }

  async installRemoteServer(serverName: string, token: string): Promise<void> {
    const serverRow = this.findServer(serverName);
    await expect(serverRow).toBeVisible();

    const installButton = serverRow.getByRole('button', { name: 'Install Remote server' });
    await installButton.click();

    const passwordInput = this.page.locator('input[type="password"]');
    await expect(passwordInput).toBeVisible({ timeout: 5_000 });
    await passwordInput.fill(token);

    const connectButton = this.page.getByRole('button', { name: 'Connect' });
    await connectButton.click();
  }
}
