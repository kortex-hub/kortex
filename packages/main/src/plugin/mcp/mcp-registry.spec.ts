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
import { beforeEach, describe, expect, test, vi } from 'vitest';

import type { ApiSenderType } from '/@/plugin/api.js';
import type { Certificates } from '/@/plugin/certificates.js';
import type { Proxy } from '/@/plugin/proxy.js';
import type { Telemetry } from '/@/plugin/telemetry/telemetry.js';
import type { IConfigurationRegistry } from '/@api/configuration/models.js';

import type { SafeStorageRegistry } from '../safe-storage/safe-storage-registry.js';
import type { MCPManager } from './mcp-manager.js';
import { MCPRegistry } from './mcp-registry.js';

// Test class to access protected methods
class TestMCPRegistry extends MCPRegistry {
  public async testListMCPServersFromRegistry(
    registryURL: string,
    cursor?: string,
  ): Promise<components['schemas']['ServerList']> {
    return this.listMCPServersFromRegistry(registryURL, cursor);
  }
}

// Mock dependencies
const apiSenderMock = {
  send: vi.fn(),
  receive: vi.fn(),
} as ApiSenderType;

const telemetryMock = {
  track: vi.fn(),
} as unknown as Telemetry;

const certificatesMock = {
  getAllCertificates: vi.fn().mockReturnValue([]),
} as unknown as Certificates;

const proxyMock = {
  onDidUpdateProxy: vi.fn(),
  onDidStateChange: vi.fn(),
  isEnabled: vi.fn().mockReturnValue(false),
} as unknown as Proxy;

const mcpManagerMock = {
  registerMCPClient: vi.fn(),
  listMCPRemoteServers: vi.fn().mockResolvedValue([]),
} as unknown as MCPManager;

const safeStorageRegistryMock = {
  getCoreStorage: vi.fn(),
} as unknown as SafeStorageRegistry;

const configurationMock = {
  get: vi.fn().mockReturnValue([]),
  update: vi.fn().mockResolvedValue(undefined),
  has: vi.fn().mockReturnValue(false),
};

const configurationRegistryMock = {
  registerConfigurations: vi.fn(),
  getConfiguration: vi.fn().mockReturnValue(configurationMock),
} as unknown as IConfigurationRegistry;

const fetchMock = vi.fn();

let mcpRegistry: TestMCPRegistry;

beforeEach(() => {
  vi.resetAllMocks();

  // Re-setup mock return values after reset
  vi.mocked(certificatesMock.getAllCertificates).mockReturnValue([]);
  vi.mocked(proxyMock.isEnabled).mockReturnValue(false);
  vi.mocked(mcpManagerMock.listMCPRemoteServers).mockResolvedValue([]);
  vi.mocked(configurationMock.get).mockReturnValue([]);
  vi.mocked(configurationMock.update).mockResolvedValue(undefined);
  vi.mocked(configurationMock.has).mockReturnValue(false);
  vi.mocked(configurationRegistryMock.getConfiguration).mockReturnValue(configurationMock);

  global.fetch = fetchMock;

  mcpRegistry = new TestMCPRegistry(
    apiSenderMock,
    telemetryMock,
    certificatesMock,
    proxyMock,
    mcpManagerMock,
    safeStorageRegistryMock,
    configurationRegistryMock,
  );
  mcpRegistry.init();
});

describe('MCPRegistry - listMCPServersFromRegistry', () => {
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

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    const result = await mcpRegistry.testListMCPServersFromRegistry('https://registry.example.com');

    expect(fetch).toHaveBeenCalledWith(
      'https://registry.example.com/v0/servers?version=latest',
      expect.objectContaining({
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }),
    );
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

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockFirstPage,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockSecondPage,
      } as Response);

    const result = await mcpRegistry.testListMCPServersFromRegistry('https://registry.example.com');

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenNthCalledWith(
      1,
      'https://registry.example.com/v0/servers?version=latest',
      expect.any(Object),
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      'https://registry.example.com/v0/servers?cursor=cursor-page-2&version=latest',
      expect.any(Object),
    );

    // Should merge both pages
    expect(result.servers).toHaveLength(2);
    expect(result.servers[0]?.server.name).toBe('io.github.example/server-1');
    expect(result.servers[1]?.server.name).toBe('io.github.example/server-2');
  });

  test('should throw error when fetch fails', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      statusText: 'Not Found',
    } as Response);

    await expect(mcpRegistry.testListMCPServersFromRegistry('https://registry.example.com')).rejects.toThrow(
      'Failed to fetch MCP servers from https://registry.example.com: Not Found',
    );
  });

  test('should validate response against schema and throw on invalid data', async () => {
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

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => invalidResponse,
    } as Response);

    await expect(mcpRegistry.testListMCPServersFromRegistry('https://registry.example.com')).rejects.toThrow(
      /Invalid response from MCP registry/,
    );
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

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as Response);

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

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    await mcpRegistry.testListMCPServersFromRegistry('https://registry.example.com', 'initial-cursor');

    expect(fetch).toHaveBeenCalledWith(
      'https://registry.example.com/v0/servers?cursor=initial-cursor&version=latest',
      expect.any(Object),
    );
  });

  test('should reject response missing _meta field', async () => {
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

    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => invalidResponse,
    } as Response);

    await expect(mcpRegistry.testListMCPServersFromRegistry('https://registry.example.com')).rejects.toThrow();
  });

  test('should validate remote type is enum value', async () => {
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

    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => responseWithInvalidRemoteType,
    } as Response);

    await expect(mcpRegistry.testListMCPServersFromRegistry('https://registry.example.com')).rejects.toThrow(
      /Invalid response from MCP registry/,
    );
  });
});
