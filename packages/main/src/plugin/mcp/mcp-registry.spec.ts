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

import { expect, test, vi } from 'vitest';

import type { IConfigurationRegistry } from '/@api/configuration/models.js';

import type { ApiSenderType } from '../api.js';
import type { Certificates } from '../certificates.js';
import type { Proxy } from '../proxy.js';
import type { SafeStorageRegistry } from '../safe-storage/safe-storage-registry.js';
import type { Telemetry } from '../telemetry/telemetry.js';
import type { MCPManager } from './mcp-manager.js';
import { MCPRegistry } from './mcp-registry.js';
import type { MCPSchemaValidator } from './mcp-schema-validator.js';

const proxy: Proxy = {
  onDidStateChange: vi.fn(),
  onDidUpdateProxy: vi.fn(),
  isEnabled: vi.fn().mockReturnValue(false),
} as unknown as Proxy;

const configurationRegistry = {
  registerConfigurations: vi.fn(),
  getConfiguration: vi.fn(),
} as unknown as IConfigurationRegistry;

const apiSender: ApiSenderType = {
  send: vi.fn(),
  receive: vi.fn(),
};

const schemaValidator: MCPSchemaValidator = {
  validateSchemaData: vi.fn().mockReturnValue(true),
};

test('listMCPServersFromRegistries', async () => {
  const mcpRegistry = new MCPRegistry(
    apiSender,
    {} as Telemetry,
    {} as Certificates,
    proxy,
    {} as MCPManager,
    {} as SafeStorageRegistry,
    configurationRegistry,
    schemaValidator,
  );

  // add suggested registries that will be used to list MCP servers from
  mcpRegistry.suggestMCPRegistry({
    name: 'Registry 1',
    url: 'https://registry1.io',
  });
  mcpRegistry.suggestMCPRegistry({
    name: 'Registry 2',
    url: 'https://registry2.io',
  });
  mcpRegistry.suggestMCPRegistry({
    name: 'Registry 3',
    url: 'https://registry3.io',
  });

  const consoleErrorSpy = vi.spyOn(console, 'error');
  const fetchSpy = vi.spyOn(global, 'fetch');
  fetchSpy.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ servers: [{ server: { name: 'Registry 1 server 1' } }] }),
  } as unknown as Response);
  fetchSpy.mockResolvedValueOnce({ ok: false, json: async () => ({}) } as unknown as Response);
  fetchSpy.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      servers: [{ server: { name: 'Registry 3 server 1' } }, { server: { name: 'Registry 3 server 2' } }],
    }),
  } as unknown as Response);

  const mcpServersFromRegistries = await mcpRegistry.listMCPServersFromRegistries();
  const serverNames = mcpServersFromRegistries.map(server => server.name);

  expect(consoleErrorSpy).toHaveBeenCalledWith(
    'Failed fetch for registry https://registry2.io',
    new Error('Failed to fetch MCP servers from https://registry2.io: undefined'),
  );
  expect(mcpServersFromRegistries).toHaveLength(3);
  expect(serverNames).toEqual(
    expect.arrayContaining(['Registry 1 server 1', 'Registry 3 server 1', 'Registry 3 server 2']),
  );
});
