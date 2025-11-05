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

import type { McpPage } from 'src/model/pages/mcp-page';

import { test } from '../fixtures/electron-app';
import { waitForNavigationReady } from '../utils/app-ready';

const MCP_REGISTRY_EXAMPLE = 'MCP Registry example';
const MCP_REGISTRY_URL = 'https://registry.modelcontextprotocol.io';
const SERVER_LIST_UPDATE_TIMEOUT = 60_000;

test.describe('MCP Registry Management', { tag: '@smoke' }, () => {
  let mcpServersPage: McpPage;

  test.beforeEach(async ({ page, navigationBar }) => {
    await waitForNavigationReady(page);
    mcpServersPage = await navigationBar.navigateToMCPPage();
  });

  test('[MCP-01] Add and remove MCP registry: verify server list updates accordingly', async () => {
    const editRegistriesTab = await mcpServersPage.openEditRegistriesTab();
    await editRegistriesTab.ensureRowExists(MCP_REGISTRY_EXAMPLE);

    const installTab = await mcpServersPage.openInstallTab();
    await installTab.verifyInstallTabIsNotEmpty();
    const initialServerCount = await installTab.countRowsFromTable();

    await mcpServersPage.openEditRegistriesTab();
    await editRegistriesTab.addNewRegistry(MCP_REGISTRY_URL);
    await editRegistriesTab.ensureRowExists(MCP_REGISTRY_URL);

    await mcpServersPage.openInstallTab();
    await installTab.verifyServerCountIncreased(initialServerCount, SERVER_LIST_UPDATE_TIMEOUT);

    await mcpServersPage.openEditRegistriesTab();
    await editRegistriesTab.removeRegistry(MCP_REGISTRY_URL);
    await editRegistriesTab.ensureRowDoesNotExist(MCP_REGISTRY_URL);

    await mcpServersPage.openInstallTab();
    await installTab.verifyServerCountIsRestored(initialServerCount);
  });
});
