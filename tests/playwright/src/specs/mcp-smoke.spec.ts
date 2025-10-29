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

const DEFAULT_REGISTRY: string = 'MCP Registry example';
const REGISTRY_URL: string = 'https://registry.modelcontextprotocol.io';
let mcpServersPage: McpPage;

test.beforeEach(async ({ page, navigationBar }) => {
  await waitForNavigationReady(page);
  mcpServersPage = await navigationBar.navigateToMCPPage();
});

test.describe('MCP page navigation', { tag: '@smoke' }, () => {
  test('[MCP-01] Add and remove MCP registry: verify server list updates accordingly', async () => {
    const editRegistriesTab = await mcpServersPage.openEditRegistriesTab();
    await editRegistriesTab.ensureRowExists(DEFAULT_REGISTRY);
    const installTab = await mcpServersPage.openInstallTab();
    await installTab.verifyInstallTabIsNotEmpty();
    const initialServerCount = await installTab.countRowsFromTable();

    await mcpServersPage.openEditRegistriesTab();
    await editRegistriesTab.addNewRegistry(REGISTRY_URL);
    await editRegistriesTab.ensureRowExists(REGISTRY_URL);
    await mcpServersPage.openInstallTab();
    await installTab.verifyServerCountIncreased(initialServerCount, 60_000);

    await mcpServersPage.openEditRegistriesTab();
    await editRegistriesTab.removeRegistry(REGISTRY_URL);
    await editRegistriesTab.ensureRowDoesNotExist(REGISTRY_URL);
    await mcpServersPage.openInstallTab();
    await installTab.verifyServerCountIsRestored(initialServerCount);
  });
});
