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

import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import type { ProviderRegistry } from '/@/plugin/provider-registry.js';
import type { ApiSenderType } from '/@api/api-sender/api-sender-type.js';
import type { IConfigurationRegistry } from '/@api/configuration/models.js';

import type { Certificates } from '../certificates.js';
import type { Proxy } from '../proxy.js';
import type { SafeStorageRegistry } from '../safe-storage/safe-storage-registry.js';
import type { Telemetry } from '../telemetry/telemetry.js';
import type { MCPManager } from './mcp-manager.js';
import { MCPRegistry, normalizeMcpRegistryServerUrl } from './mcp-registry.js';
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

const validateSchemaDataMock = vi.fn().mockReturnValue(true);

const schemaValidator: MCPSchemaValidator = {
  validateSchemaData: validateSchemaDataMock,
};

let mcpRegistry: MCPRegistry;

const globalFetch = vi.fn();
global.fetch = globalFetch;

const originalConsoleError = console.error;

const providerRegistry = {
  onDidRegisterRagConnection: vi.fn(),
  onDidUnregisterRagConnection: vi.fn(),
  onDidUpdateRagConnection: vi.fn(),
} as unknown as ProviderRegistry;

beforeEach(() => {
  console.error = vi.fn();

  mcpRegistry = new MCPRegistry(
    apiSender,
    { track: vi.fn() } as unknown as Telemetry,
    {} as Certificates,
    proxy,
    {} as MCPManager,
    {} as SafeStorageRegistry,
    configurationRegistry,
    schemaValidator,
    providerRegistry,
  );
});

afterEach(() => {
  console.error = originalConsoleError;
});

test('normalizeMcpRegistryServerUrl adds https for host-only input', () => {
  expect(normalizeMcpRegistryServerUrl('registry.modelcontextprotocol.io')).toBe(
    'https://registry.modelcontextprotocol.io',
  );
  expect(normalizeMcpRegistryServerUrl('  https://example.com/path  ')).toBe('https://example.com/path');
  expect(normalizeMcpRegistryServerUrl('http://localhost:8080')).toBe('http://localhost:8080');
});

test('normalizeMcpRegistryServerUrl strips trailing slashes', () => {
  expect(normalizeMcpRegistryServerUrl('https://registry.example.com/base///')).toBe(
    'https://registry.example.com/base',
  );
  expect(normalizeMcpRegistryServerUrl('registry.example.com/')).toBe('https://registry.example.com');
});

test('listMCPServersFromRegistries uses https for host-only suggested registry URLs', async () => {
  mcpRegistry.suggestMCPRegistry({
    name: 'Host only',
    url: 'registry.example.com',
  });
  globalFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ servers: [] }),
  } as unknown as Response);

  await mcpRegistry.listMCPServersFromRegistries();

  expect(globalFetch).toHaveBeenCalledWith('https://registry.example.com/v0/servers?version=latest', expect.anything());
});

test('listMCPServersFromRegistries strips trailing slashes from registry base URL', async () => {
  mcpRegistry.suggestMCPRegistry({
    name: 'Trailing slashes',
    url: 'https://registry.example.com/base///',
  });
  globalFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ servers: [] }),
  } as unknown as Response);

  await mcpRegistry.listMCPServersFromRegistries();

  expect(globalFetch).toHaveBeenCalledWith(
    'https://registry.example.com/base/v0/servers?version=latest',
    expect.anything(),
  );
});

test('updateMCPRegistry sends normalized URL in API event and fire', async () => {
  // Register with a normalized URL so the registry exists internally
  mcpRegistry.registerMCPRegistry({ serverUrl: 'https://registry.example.com' }, false);

  // Update using a non-normalized URL (trailing slash)
  await mcpRegistry.updateMCPRegistry({ serverUrl: 'https://registry.example.com/' });

  expect(apiSender.send).toHaveBeenCalledWith(
    'mcp-registry-update',
    expect.objectContaining({ serverUrl: 'https://registry.example.com' }),
  );
});

test('updateMCPRegistry throws when registry not found after normalization', async () => {
  await expect(mcpRegistry.updateMCPRegistry({ serverUrl: 'https://unknown.example.com/' })).rejects.toThrow(
    'MCP Registry https://unknown.example.com was not found',
  );
});

test('unsuggestMCPRegistry sends normalized URL in API event', () => {
  // Suggest with a host-only URL (gets normalized to https://)
  mcpRegistry.suggestMCPRegistry({ name: 'Test', url: 'registry.example.com' });
  vi.mocked(apiSender.send).mockClear();

  // Unsuggest using the non-normalized form
  mcpRegistry.unsuggestMCPRegistry({ name: 'Test', url: 'registry.example.com/' });

  expect(apiSender.send).toHaveBeenCalledWith(
    'mcp-registry-update',
    expect.objectContaining({ url: 'https://registry.example.com', name: 'Test' }),
  );
});

test('listMCPServersFromRegistries', async () => {
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

  globalFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ servers: [{ server: { name: 'Registry 1 server 1' } }] }),
  } as unknown as Response);
  globalFetch.mockResolvedValueOnce({ ok: false, json: async () => ({}) } as unknown as Response);
  globalFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      servers: [{ server: { name: 'Registry 3 server 1' } }, { server: { name: 'Registry 3 server 2' } }],
    }),
  } as unknown as Response);

  const mcpServersFromRegistries = await mcpRegistry.listMCPServersFromRegistries();
  const serverNames = mcpServersFromRegistries.map(server => server.name);

  expect(console.error).toHaveBeenCalledWith(
    'Failed fetch for registry https://registry2.io',
    new Error('Failed to fetch MCP servers from https://registry2.io: undefined'),
  );
  expect(mcpServersFromRegistries).toHaveLength(3);
  expect(serverNames).toEqual(
    expect.arrayContaining(['Registry 1 server 1', 'Registry 3 server 1', 'Registry 3 server 2']),
  );
});

test('listMCPServersFromRegistries marks servers with invalid schemas', async () => {
  // Mock validateSchemaData to return invalid for specific servers
  validateSchemaDataMock.mockImplementation((data: unknown) => {
    const serverResponse = data as { server: { name: string } };
    const isValid = serverResponse?.server?.name !== 'Invalid server';
    return isValid;
  });

  mcpRegistry.suggestMCPRegistry({
    name: 'Test Registry',
    url: 'https://test-registry.io',
  });

  globalFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      servers: [
        { server: { name: 'Valid server', description: 'A valid server', version: '1.0.0' }, _meta: {} },
        { server: { name: 'Invalid server', description: 'An invalid server', version: '1.0.0' }, _meta: {} },
      ],
    }),
  } as unknown as Response);

  const mcpServersFromRegistries = await mcpRegistry.listMCPServersFromRegistries();

  expect(mcpServersFromRegistries).toHaveLength(2);

  const validServer = mcpServersFromRegistries.find(s => s.name === 'Valid server');
  const invalidServer = mcpServersFromRegistries.find(s => s.name === 'Invalid server');

  expect(validServer?.isValidSchema).toBe(true);
  expect(invalidServer?.isValidSchema).toBe(false);
});

test('listMCPServersFromRegistries updates existing servers when registry is updated', async () => {
  // Reset mock to return true for all servers
  validateSchemaDataMock.mockReturnValue(true);

  mcpRegistry.suggestMCPRegistry({
    name: 'Update Test Registry',
    url: 'https://update-registry.io',
  });

  // First call - initial server list
  globalFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      servers: [
        { server: { name: 'Server A', description: 'Original description', version: '1.0.0' }, _meta: {} },
        { server: { name: 'Server B', description: 'Another server', version: '1.0.0' }, _meta: {} },
      ],
    }),
  } as unknown as Response);

  const firstResult = await mcpRegistry.listMCPServersFromRegistries();
  expect(firstResult).toHaveLength(2);
  const serverA = firstResult.find(s => s.name === 'Server A');
  expect(serverA?.description).toBe('Original description');

  // Second call - Server A updated with new description
  globalFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      servers: [
        { server: { name: 'Server A', description: 'Updated description', version: '2.0.0' }, _meta: {} },
        { server: { name: 'Server B', description: 'Another server', version: '1.0.0' }, _meta: {} },
      ],
    }),
  } as unknown as Response);

  const secondResult = await mcpRegistry.listMCPServersFromRegistries();
  expect(secondResult).toHaveLength(2);

  const updatedServerA = secondResult.find(s => s.name === 'Server A');
  const unchangedServerB = secondResult.find(s => s.name === 'Server B');

  expect(updatedServerA?.description).toBe('Updated description');
  expect(updatedServerA?.version).toBe('2.0.0');
  expect(unchangedServerB?.description).toBe('Another server');
});

test('listMCPServersFromRegistries adds new servers when registry is updated', async () => {
  // Reset mock to return true for all servers
  validateSchemaDataMock.mockReturnValue(true);

  mcpRegistry.suggestMCPRegistry({
    name: 'Add Test Registry',
    url: 'https://add-registry.io',
  });

  // First call - initial server list with 2 servers
  globalFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      servers: [
        { server: { name: 'Server 1', description: 'First server', version: '1.0.0' }, _meta: {} },
        { server: { name: 'Server 2', description: 'Second server', version: '1.0.0' }, _meta: {} },
      ],
    }),
  } as unknown as Response);

  const firstResult = await mcpRegistry.listMCPServersFromRegistries();
  expect(firstResult).toHaveLength(2);
  expect(firstResult.map(s => s.name)).toEqual(expect.arrayContaining(['Server 1', 'Server 2']));

  // Second call - registry now has 3 servers (new server added)
  globalFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      servers: [
        { server: { name: 'Server 1', description: 'First server', version: '1.0.0' }, _meta: {} },
        { server: { name: 'Server 2', description: 'Second server', version: '1.0.0' }, _meta: {} },
        { server: { name: 'Server 3', description: 'New server', version: '1.0.0' }, _meta: {} },
      ],
    }),
  } as unknown as Response);

  const secondResult = await mcpRegistry.listMCPServersFromRegistries();
  expect(secondResult).toHaveLength(3);

  const serverNames = secondResult.map(s => s.name);
  expect(serverNames).toEqual(expect.arrayContaining(['Server 1', 'Server 2', 'Server 3']));

  const newServer = secondResult.find(s => s.name === 'Server 3');
  expect(newServer?.description).toBe('New server');
});

test('listMCPServersFromRegistries handles both updates and additions', async () => {
  // Reset mock to return true for all servers
  validateSchemaDataMock.mockReturnValue(true);

  mcpRegistry.suggestMCPRegistry({
    name: 'Combined Test Registry',
    url: 'https://combined-registry.io',
  });

  // First call - initial state
  globalFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      servers: [
        { server: { name: 'Alpha', description: 'Original alpha', version: '1.0.0' }, _meta: {} },
        { server: { name: 'Beta', description: 'Original beta', version: '1.0.0' }, _meta: {} },
      ],
    }),
  } as unknown as Response);

  const firstResult = await mcpRegistry.listMCPServersFromRegistries();
  expect(firstResult).toHaveLength(2);

  // Second call - Alpha updated AND Gamma added
  globalFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      servers: [
        { server: { name: 'Alpha', description: 'Updated alpha', version: '2.0.0' }, _meta: {} },
        { server: { name: 'Beta', description: 'Original beta', version: '1.0.0' }, _meta: {} },
        { server: { name: 'Gamma', description: 'New gamma', version: '1.0.0' }, _meta: {} },
      ],
    }),
  } as unknown as Response);

  const secondResult = await mcpRegistry.listMCPServersFromRegistries();
  expect(secondResult).toHaveLength(3);

  const updatedAlpha = secondResult.find(s => s.name === 'Alpha');
  const unchangedBeta = secondResult.find(s => s.name === 'Beta');
  const newGamma = secondResult.find(s => s.name === 'Gamma');

  // Verify the update
  expect(updatedAlpha?.description).toBe('Updated alpha');
  expect(updatedAlpha?.version).toBe('2.0.0');

  // Verify unchanged server
  expect(unchangedBeta?.description).toBe('Original beta');
  expect(unchangedBeta?.version).toBe('1.0.0');

  // Verify the new addition
  expect(newGamma?.description).toBe('New gamma');
  expect(newGamma?.version).toBe('1.0.0');
});
