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

import * as os from 'node:os';

import { expect, test } from '../../fixtures/provider-fixtures';
import { MCP_SERVERS } from '../../model/core/types';
import { waitForNavigationReady } from '../../utils/app-ready';

const isMacOS26 = process.platform === 'darwin' && os.release().startsWith('25');
const isCI = !!process.env.CI;

test.skip(isMacOS26 && isCI, 'Skipping on macOS 26 gha runners due to stability issues');

const MCP_REGISTRY_EXAMPLE = 'MCP Registry example';
const MCP_REGISTRY_URL = 'https://registry.modelcontextprotocol.io';
const SERVER_LIST_UPDATE_TIMEOUT = 120_000;
const SERVER_CONNECTION_TIMEOUT = 10_000;

// Configure MCP setup only when GITHUB_TOKEN is available and not on Linux
test.use({
  mcpServers: process.env[MCP_SERVERS.github.envVarName] && process.platform !== 'linux' ? ['github'] : [],
});

test.describe('MCP Registry Management', { tag: '@smoke' }, () => {
  test.beforeEach(async ({ page, navigationBar }) => {
    await waitForNavigationReady(page);
    await navigationBar.navigateToMCPPage();
  });

  test('[MCP-01] Add and remove MCP registry: verify server list updates accordingly', async ({ mcpPage }) => {
    test.skip(isMacOS26, 'Skipping on macOS 26 due to CI stability issues');

    const editRegistriesTab = await mcpPage.openEditRegistriesTab();
    await editRegistriesTab.ensureRowExists(MCP_REGISTRY_EXAMPLE);

    const installTab = await mcpPage.openInstallTab();
    await installTab.verifyInstallTabIsNotEmpty();
    const initialServerCount = await installTab.countRowsFromTable();

    await mcpPage.openEditRegistriesTab();
    await editRegistriesTab.addNewRegistry(MCP_REGISTRY_URL);
    await editRegistriesTab.ensureRowExists(MCP_REGISTRY_URL);

    await mcpPage.openInstallTab();
    await installTab.verifyServerCountIncreased(initialServerCount, SERVER_LIST_UPDATE_TIMEOUT);

    await mcpPage.openEditRegistriesTab();
    await editRegistriesTab.removeRegistry(MCP_REGISTRY_URL);
    await editRegistriesTab.ensureRowDoesNotExist(MCP_REGISTRY_URL);

    await mcpPage.openInstallTab();
    await installTab.verifyServerCountIsRestored(initialServerCount);
  });

  test('[MCP-02] Add and remove MCP server: verify server list updates accordingly', async ({
    mcpSetup: _mcpSetup,
    mcpPage,
  }) => {
    const isLinux = process.platform === 'linux';
    const hasGithubToken = !!process.env[MCP_SERVERS.github.envVarName];

    // Skip conditions - safeStorage has issues on Linux
    const skipConditions: Array<{ condition: boolean; reason: string }> = [
      { condition: !hasGithubToken, reason: `${MCP_SERVERS.github.envVarName} environment variable is not set` },
      { condition: isLinux, reason: 'safeStorage issues on Linux' },
    ];

    for (const { condition, reason } of skipConditions) {
      test.skip(condition, reason);
    }

    // Expect failure locally until https://github.com/kortex-hub/kortex/issues/651 is fixed
    if (!isCI) {
      test.fail();
    }

    const serverName = MCP_SERVERS.github.serverName;
    const mcpReadyTab = await mcpPage.openReadyTab();

    await expect
      .poll(async () => await mcpReadyTab.isServerConnected(serverName), { timeout: SERVER_CONNECTION_TIMEOUT })
      .toBeTruthy();
  });
});
