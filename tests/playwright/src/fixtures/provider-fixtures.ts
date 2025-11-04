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
import { type ElectronApplication, type Page } from '@playwright/test';

import { MCP_SERVERS, type MCPServerId } from '../model/core/types';
import { NavigationBar } from '../model/navigation/navigation';
import { PROVIDERS, type ResourceId } from '../utils/resource-helper';
import { type ElectronFixtures, getFirstPage, launchElectronApp, test as base } from './electron-app';

interface WorkerFixtures {
  workerElectronApp: ElectronApplication;
  workerPage: Page;
  workerNavigationBar: NavigationBar;
  resource: ResourceId;
  resourceSetup: void;
  mcpServers: MCPServerId[];
  mcpSetup: void;
}

function requireEnvVar(envVarName: string): string {
  const value = process.env[envVarName];
  if (!value) {
    throw new Error(`${envVarName} environment variable is not set`);
  }
  return value;
}

async function safeCleanup(operation: () => Promise<void>, errorMessage: string): Promise<void> {
  try {
    await operation();
  } catch (error) {
    console.error(`${errorMessage}:`, error);
  }
}

export const test = base.extend<ElectronFixtures, WorkerFixtures>({
  resource: [
    'gemini' as ResourceId,
    {
      scope: 'worker',
      option: true,
    },
  ],

  mcpServers: [
    ['github'] as MCPServerId[],
    {
      scope: 'worker',
      option: true,
    },
  ],

  workerElectronApp: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use): Promise<void> => {
      const electronApp = await launchElectronApp();
      await use(electronApp);
      await electronApp.close();
    },
    { scope: 'worker' },
  ],

  workerPage: [
    async ({ workerElectronApp }, use): Promise<void> => {
      const page = await getFirstPage(workerElectronApp);
      await use(page);
    },
    { scope: 'worker' },
  ],

  workerNavigationBar: [
    async ({ workerPage }, use): Promise<void> => {
      const navigationBar = new NavigationBar(workerPage);
      await use(navigationBar);
    },
    { scope: 'worker' },
  ],

  resourceSetup: [
    async ({ workerNavigationBar, resource }, use): Promise<void> => {
      try {
        const provider = PROVIDERS[resource];
        const credentials = requireEnvVar(provider.envVarName);
        const settingsPage = await workerNavigationBar.navigateToSettingsPage();
        await settingsPage.createResource(resource, credentials);
        await use();
      } finally {
        await safeCleanup(async () => {
          const settingsPage = await workerNavigationBar.navigateToSettingsPage();
          await settingsPage.deleteResource(resource);
        }, `Failed to delete ${resource} resource`);
      }
    },
    { scope: 'worker', auto: true },
  ],

  mcpSetup: [
    async ({ workerNavigationBar, mcpServers }, use): Promise<void> => {
      const configuredServers: Array<{ id: MCPServerId; serverName: string }> = [];

      try {
        const mcpPage = await workerNavigationBar.navigateToMCPPage();

        for (const id of mcpServers) {
          const server = MCP_SERVERS[id];
          const token = requireEnvVar(server.envVarName);

          try {
            await mcpPage.createServer(server.serverName, token);
            configuredServers.push({ id, serverName: server.serverName });
          } catch (error) {
            console.warn(`MCP setup skipped for ${id}:`, error);
            throw error;
          }
        }

        await use();
      } finally {
        if (configuredServers.length > 0) {
          const mcpPage = await workerNavigationBar.navigateToMCPPage();

          await Promise.allSettled(
            configuredServers.map(({ id, serverName }) =>
              safeCleanup(() => mcpPage.deleteServer(serverName), `Failed to delete ${id} MCP server`),
            ),
          );
        }
      }
    },
    { scope: 'worker', auto: false },
  ],

  electronApp: async ({ workerElectronApp }, use): Promise<void> => {
    await use(workerElectronApp);
  },

  page: async ({ workerPage }, use): Promise<void> => {
    await use(workerPage);
  },
});

export { expect } from '@playwright/test';
