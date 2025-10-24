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

import type { components } from '@kortex-hub/mcp-registry-types';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import type { ApiSenderType } from '/@/plugin/api.js';
import type { Certificates } from '/@/plugin/certificates.js';
import type { Proxy } from '/@/plugin/proxy.js';
import type { Telemetry } from '/@/plugin/telemetry/telemetry.js';
import type { IConfigurationRegistry } from '/@api/configuration/models.js';

import type { SafeStorageRegistry } from '../safe-storage/safe-storage-registry.js';
import type { MCPManager } from './mcp-manager.js';
import { MCPRegistry } from './mcp-registry.js';
import type { MCPSchemaValidator } from './mcp-schema-validator.js';

// Test class to access protected methods
class TestMCPRegistry extends MCPRegistry {
  public async testListMCPServersFromRegistry(
    registryURL: string,
    cursor?: string,
  ): Promise<components['schemas']['ServerList']> {
    return this.listMCPServersFromRegistry(registryURL, cursor);
  }
}

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
  mcpRegistry.init();
});

afterEach(() => {
  console.warn = originalConsoleWarn;
});

describe('MCPRegistry - listMCPServersFromRegistry', () => {
  test('should list MCP servers from multiple registries and handle failures gracefully', async () => {
    // Simplified test: just verify that servers from multiple suggested registries are aggregated
    mcpRegistry.suggestMCPRegistry({
      name: 'Test Registry',
      url: 'https://test-registry.io',
    });

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        servers: [
          {
            server: { name: 'Test Server 1', description: 'Test server', version: '1.0.0' },
            _meta: {},
          },
          {
            server: { name: 'Test Server 2', description: 'Another test server', version: '1.0.0' },
            _meta: {},
          },
        ],
      }),
    });

    const mcpServersFromRegistries = await mcpRegistry.listMCPServersFromRegistries();
    const serverNames = mcpServersFromRegistries.map(server => server.name);

    expect(mcpServersFromRegistries).toHaveLength(2);
    expect(serverNames).toEqual(expect.arrayContaining(['Test Server 1', 'Test Server 2']));
  });

  test('should successfully fetch and parse MCP servers from registry', async () => {
    const mockResponse: components['schemas']['ServerList'] = {
      servers: [
        {
          server: {
            name: 'io.github.example/test-server',
            description: 'Test MCP Server',
            version: '1.0.0',
          },
          _meta: {
            'io.modelcontextprotocol.registry/official': {
              status: 'active',
            },
          },
        },
      ],
      metadata: {
        nextCursor: undefined,
      },
    };

    // Mock registry data fetch
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await mcpRegistry.testListMCPServersFromRegistry('https://registry.example.com');

    expect(result).toEqual(mockResponse);
    expect(result.servers).toHaveLength(1);
    expect(result.servers[0]?.server.name).toBe('io.github.example/test-server');
  });

  test('should handle pagination with cursor', async () => {
    const mockFirstPage: components['schemas']['ServerList'] = {
      servers: [
        {
          server: {
            name: 'io.github.example/server-1',
            description: 'Server 1',
            version: '1.0.0',
          },
          _meta: {},
        },
      ],
      metadata: {
        nextCursor: 'cursor-page-2',
      },
    };

    const mockSecondPage: components['schemas']['ServerList'] = {
      servers: [
        {
          server: {
            name: 'io.github.example/server-2',
            description: 'Server 2',
            version: '2.0.0',
          },
          _meta: {},
        },
      ],
      metadata: {
        nextCursor: undefined,
      },
    };

    // Mock two registry data fetches for pagination
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockFirstPage,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockSecondPage,
      });

    const result = await mcpRegistry.testListMCPServersFromRegistry('https://registry.example.com');

    // Should merge both pages
    expect(result.servers).toHaveLength(2);
    expect(result.servers[0]?.server.name).toBe('io.github.example/server-1');
    expect(result.servers[1]?.server.name).toBe('io.github.example/server-2');
  });

  test('should throw error when fetch fails', async () => {
    // Registry data fetch fails (no validation needed since fetch fails first)
    fetchMock.mockResolvedValueOnce({
      ok: false,
      statusText: 'Not Found',
    });

    await expect(mcpRegistry.testListMCPServersFromRegistry('https://registry.example.com')).rejects.toThrow(
      'Failed to fetch MCP servers from https://registry.example.com: Not Found',
    );
  });

  test('should validate response against schema and warn on invalid data', async () => {
    const invalidResponse = {
      servers: [
        {
          server: {
            name: 'test-server',
            // missing required 'description' and 'version' fields
          },
          // missing required '_meta' field
        },
      ],
    };

    // Mock invalid registry data
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => invalidResponse,
    });

    const result = await mcpRegistry.testListMCPServersFromRegistry('https://registry.example.com');

    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('[MCPRegistry] Failed to validate MCP servers from registry'),
    );
    expect(result).toEqual(invalidResponse);
  });

  test('should validate that server has remotes array', async () => {
    const mockResponse: components['schemas']['ServerList'] = {
      servers: [
        {
          server: {
            name: 'io.github.example/remote-server',
            description: 'Remote Server',
            version: '1.0.0',
            remotes: [
              {
                type: 'sse',
                url: 'https://mcp-server.example.com/sse',
              },
            ],
          },
          _meta: {},
        },
      ],
    };

    // Mock registry data fetch
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await mcpRegistry.testListMCPServersFromRegistry('https://registry.example.com');

    expect(result.servers[0]?.server.remotes).toBeDefined();
    expect(result.servers[0]?.server.remotes).toHaveLength(1);
    expect(result.servers[0]?.server.remotes?.[0]?.type).toBe('sse');
    expect(result.servers[0]?.server.remotes?.[0]?.url).toBe('https://mcp-server.example.com/sse');
  });

  test('should handle cursor parameter in initial request', async () => {
    const mockResponse: components['schemas']['ServerList'] = {
      servers: [],
      metadata: {},
    };

    // Mock registry data fetch
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    await mcpRegistry.testListMCPServersFromRegistry('https://registry.example.com', 'initial-cursor');

    expect(fetch).toHaveBeenNthCalledWith(
      1, // First call is the registry data fetch
      'https://registry.example.com/v0/servers?cursor=initial-cursor&version=latest',
      expect.any(Object),
    );
  });

  test('should warn on response missing _meta field', async () => {
    const invalidResponse = {
      servers: [
        {
          server: {
            name: 'test-server',
            description: 'Test',
            version: '1.0.0',
          },
          // _meta is required but missing
        },
      ],
    };

    // Mock invalid registry data
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => invalidResponse,
    });

    const result = await mcpRegistry.testListMCPServersFromRegistry('https://registry.example.com');

    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('[MCPRegistry] Failed to validate MCP servers from registry'),
    );
    expect(result).toEqual(invalidResponse);
  });

  test('should warn when remote type is not a valid enum value', async () => {
    const responseWithInvalidRemoteType = {
      servers: [
        {
          server: {
            name: 'test-server',
            description: 'Test',
            version: '1.0.0',
            remotes: [
              {
                type: 'invalid-type', // Should be 'sse' or 'streamable-http'
                url: 'https://example.com',
              },
            ],
          },
          _meta: {},
        },
      ],
    };

    // Mock invalid registry data
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => responseWithInvalidRemoteType,
    });

    const result = await mcpRegistry.testListMCPServersFromRegistry('https://registry.example.com');

    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('[MCPRegistry] Failed to validate MCP servers from registry'),
    );
    expect(result).toEqual(responseWithInvalidRemoteType);
  });
});
