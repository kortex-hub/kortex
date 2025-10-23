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

test.describe('MCP page navigation', { tag: '@smoke' }, () => {
  test('[MCP-01] Add a new MCP Registry', async () => {
    const editRegistriesTab = await mcpServersPage.openEditRegistriesTab();
    await editRegistriesTab.addNewMcpRegistry(REGISTRY_URL);
    const newRegistry = await editRegistriesTab.getRegistryByUrl(REGISTRY_URL);
    await expect(newRegistry).toBeVisible();
  });

  test('[MCP-02] New MCP servers should be available to install', async () => {
    const installTab = await mcpServersPage.openInstallTab();
    //The number of MCP servers should be greater than 2, including the default MCP server and the header row.
    await expect
      .poll(async () => await installTab.availableMcpServersTable.getByRole('row').count(), { timeout: 30_000 })
      .toBeGreaterThan(2);
  });
});
