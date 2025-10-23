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

import type { Page } from '@playwright/test';
import { McpEditRegistriesTabPage } from 'src/model/navigation/pages/mcp-edit-registries-tab-page';
import { McpInstallTabPage } from 'src/model/navigation/pages/mcp-install-tab-page';
import { McpServersPage } from 'src/model/navigation/pages/mcp-servers-page';

import { expect, test } from '../fixtures/electron-app';
import { NavigationBar } from '../model/navigation/navigation';
import { waitForNavigationReady } from '../utils/app-ready';

const REGISTRY_URL: string = 'https://registry.modelcontextprotocol.io';
let navigationBar: NavigationBar;
let mcpServersPage: McpServersPage;

test.beforeEach(async ({ page }) => {
  navigationBar = new NavigationBar(page);
  mcpServersPage = new McpServersPage(page);
  await waitForNavigationReady(page);
  await navigationBar.mcpLink.click();
  await mcpServersPage.waitForLoad();
});

test.describe('MCP page smoke tests', { tag: '@smoke' }, () => {
  test('[MCP-01] Add a new MCP Registry', async ({ page }) => {
    const editRegistriesTab = await openEditRegistriesTab(mcpServersPage, page);
    await editRegistriesTab.addNewMcpRegistry(REGISTRY_URL);
    const newRegistry = await editRegistriesTab.getRegistryByUrl(REGISTRY_URL);
    await expect(newRegistry).toBeVisible();
  });

  test('[MCP-02] New MCP servers should be available to install', async ({ page }) => {
    const installTab = await openInstallTab(mcpServersPage, page);
    const rowCount = await installTab.availableMcpServersTable.getByRole('row').count();
    // The amount of MCP servers should be greater than one, excluding header row
    expect(rowCount - 1, 'Expected more than one default MCP server row').toBeGreaterThan(1);
  });
});

async function openEditRegistriesTab(mcpServersPage: McpServersPage, page: Page): Promise<McpEditRegistriesTabPage> {
  await expect(mcpServersPage.editRegistriesTabButton).toBeEnabled();
  await mcpServersPage.editRegistriesTabButton.click();
  const editRegistriesTab = new McpEditRegistriesTabPage(page);
  await editRegistriesTab.waitForLoad();
  return editRegistriesTab;
}

async function openInstallTab(mcpServersPage: McpServersPage, page: Page): Promise<McpInstallTabPage> {
  await expect(mcpServersPage.installTabButton).toBeEnabled();
  await mcpServersPage.installTabButton.click();
  const installTabPage = new McpInstallTabPage(page);
  await installTabPage.waitForLoad();
  return installTabPage;
}
