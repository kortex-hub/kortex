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

import type containerDesktopAPI from '@kortex-app/api';
import type { MCPInstance, MCPManager } from '@kortex-hub/mcp-manager';
import type { MCPRegistryClient } from '@kortex-hub/mcp-registry-client';
import type { components } from '@kortex-hub/mcp-registry-types';
import type { IpcMainInvokeEvent } from 'electron/main';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import type { IPCHandle } from '/@/plugin/api.js';
import type { MCPAIClients } from '/@/plugin/mcp/mcp-ai-clients.js';
import { MCPIPCHandler } from '/@/plugin/mcp/mcp-ipc-handler.js';
import type { McpRegistries } from '/@/plugin/mcp/mcp-registries.js';
import type { MCPRegistriesClients } from '/@/plugin/mcp/mcp-registries-clients.js';
import type { MCPStatuses } from '/@/plugin/mcp/mcp-statuses.js';
import type { MCPConfigInfo } from '/@api/mcp/mcp-config-info.js';
import type { MCPSetupOptions, MCPSetupRemoteOptions } from '/@api/mcp/mcp-setup.js';

const IPC_HANDLE_MOCK: IPCHandle = vi.fn();
const MCP_MANAGER_MOCK: MCPManager = {
  unregister: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  registerRemote: vi.fn(),
  registerPackage: vi.fn(),
} as unknown as MCPManager;
const MCP_AI_CLIENTS: MCPAIClients = {
  init: vi.fn(),
  getToolSet: vi.fn(),
} as unknown as MCPAIClients;
const MCP_STATUSES: MCPStatuses = {
  init: vi.fn(),
  collect: vi.fn(),
} as unknown as MCPStatuses;
const MCP_REGISTRIES_CLIENTS: MCPRegistriesClients = {
  init: vi.fn(),
  getClient: vi.fn(),
} as unknown as MCPRegistriesClients;
const MCP_REGISTRIES: McpRegistries = {
  init: vi.fn(),
  registerMCPRegistry: vi.fn(),
  getRegistries: vi.fn(),
  getSuggestedRegistries: vi.fn(),
  createRegistry: vi.fn(),
  unregisterMCPRegistry: vi.fn(),
} as unknown as McpRegistries;
const MCP_REGISTRY_CLIENT: MCPRegistryClient = {
  getServers: vi.fn(),
  getServer: vi.fn(),
} as unknown as MCPRegistryClient;
const IPC_MAIN_INVOKE_EVENT: IpcMainInvokeEvent = {} as unknown as IpcMainInvokeEvent;

const MCP_INSTANCE_MOCK: MCPInstance = {
  configId: vi.fn(),
  transport: {},
} as unknown as MCPInstance;

class MCPIPCHandlerTest extends MCPIPCHandler {
  public override async getMcpRegistries(): Promise<readonly containerDesktopAPI.MCPRegistry[]> {
    return super.getMcpRegistries();
  }

  public override async getMcpRegistryServers(
    _: IpcMainInvokeEvent,
    registryURL: string,
    cursor: string | undefined,
    limit: number | undefined,
  ): Promise<components['schemas']['ServerList']> {
    return super.getMcpRegistryServers(_, registryURL, cursor, limit);
  }

  public override async getMCPServerDetails(
    _: IpcMainInvokeEvent,
    registryURL: string,
    serverId: string,
    version?: string,
  ): Promise<components['schemas']['ServerDetail']> {
    return super.getMCPServerDetails(_, registryURL, serverId, version);
  }

  public override async getMcpSuggestedRegistries(): Promise<containerDesktopAPI.MCPRegistrySuggestedProvider[]> {
    return super.getMcpSuggestedRegistries();
  }

  public override async unregisterMCPRegistry(
    _: IpcMainInvokeEvent,
    registry: containerDesktopAPI.MCPRegistry,
  ): Promise<void> {
    return super.unregisterMCPRegistry(_, registry);
  }

  public override async collectMCPStatuses(): Promise<Array<MCPConfigInfo>> {
    return super.collectMCPStatuses();
  }

  public override async startMCP(_: IpcMainInvokeEvent, configId: string): Promise<void> {
    return super.startMCP(_, configId);
  }

  public override async stopMCP(_: IpcMainInvokeEvent, configId: string): Promise<void> {
    return super.stopMCP(_, configId);
  }

  public override async unregisterMCP(_: IpcMainInvokeEvent, configId: string): Promise<void> {
    return super.unregisterMCP(_, configId);
  }

  public override async getMCPTools(
    _: IpcMainInvokeEvent,
    configId: string,
  ): Promise<
    Record<
      string,
      {
        description: string;
      }
    >
  > {
    return super.getMCPTools(_, configId);
  }

  public override async createMCPRegistry(
    _: IpcMainInvokeEvent,
    registryCreateOptions: containerDesktopAPI.MCPRegistryCreateOptions,
  ): Promise<void> {
    return super.createMCPRegistry(_, registryCreateOptions);
  }

  public override async setupMCP(_: IpcMainInvokeEvent, options: MCPSetupOptions): Promise<string> {
    return super.setupMCP(_, options);
  }
}

let mcpIPCHandlerTest: MCPIPCHandlerTest;

beforeEach(() => {
  vi.resetAllMocks();

  mcpIPCHandlerTest = new MCPIPCHandlerTest(
    IPC_HANDLE_MOCK,
    MCP_MANAGER_MOCK,
    MCP_AI_CLIENTS,
    MCP_STATUSES,
    MCP_REGISTRIES_CLIENTS,
    MCP_REGISTRIES,
  );
  vi.mocked(MCP_REGISTRIES_CLIENTS.getClient).mockReturnValue(MCP_REGISTRY_CLIENT);
  vi.mocked(MCP_AI_CLIENTS.getToolSet).mockResolvedValue({});
  vi.mocked(MCP_MANAGER_MOCK.registerRemote).mockResolvedValue(MCP_INSTANCE_MOCK);
  vi.mocked(MCP_MANAGER_MOCK.registerPackage).mockResolvedValue(MCP_INSTANCE_MOCK);
  vi.mocked(MCP_MANAGER_MOCK.start).mockResolvedValue(MCP_INSTANCE_MOCK);
});

describe('MCPIPCHandler#init', () => {
  test('expect all inits to be called', () => {
    mcpIPCHandlerTest.init();

    expect(MCP_REGISTRIES.init).toHaveBeenCalled();
    expect(MCP_REGISTRIES_CLIENTS.init).toHaveBeenCalled();
    expect(MCP_STATUSES.init).toHaveBeenCalled();
    expect(MCP_AI_CLIENTS.init).toHaveBeenCalled();
  });
});

describe('MCPIPCHandler#getMcpRegistries', () => {
  test('should call MCPRegistries.getRegistries', async () => {
    await mcpIPCHandlerTest.getMcpRegistries();

    expect(MCP_REGISTRIES.getRegistries).toHaveBeenCalledOnce();
  });
});

describe('MCPIPCHandler#getMcpRegistryServers', () => {
  test('should call getMcpRegistryServers', async () => {
    await mcpIPCHandlerTest.getMcpRegistryServers(IPC_MAIN_INVOKE_EVENT, 'registry-url', 'cursor-foo', 55);

    expect(MCP_REGISTRIES_CLIENTS.getClient).toHaveBeenCalledExactlyOnceWith('registry-url');
    expect(MCP_REGISTRY_CLIENT.getServers).toHaveBeenCalledExactlyOnceWith({
      query: {
        cursor: 'cursor-foo',
        limit: 55,
      },
    });
  });
});

describe('MCPIPCHandler#getMCPServerDetails', () => {
  test('should call getMCPServerDetails', async () => {
    await mcpIPCHandlerTest.getMCPServerDetails(IPC_MAIN_INVOKE_EVENT, 'registry-url', 'server-id', 'v1.0.0');

    expect(MCP_REGISTRIES_CLIENTS.getClient).toHaveBeenCalledExactlyOnceWith('registry-url');
    expect(MCP_REGISTRY_CLIENT.getServer).toHaveBeenCalledExactlyOnceWith({
      query: {
        version: 'v1.0.0',
      },
      path: {
        server_id: 'server-id',
      },
    });
  });
});

describe('MCPIPCHandler#getMcpSuggestedRegistries', () => {
  test('should call MCPRegistries.getSuggestedRegistries', async () => {
    await mcpIPCHandlerTest.getMcpSuggestedRegistries();

    expect(MCP_REGISTRIES.getSuggestedRegistries).toHaveBeenCalledOnce();
  });
});

describe('MCPIPCHandler#unregisterMCPRegistry', () => {
  test('should call MCPRegistries.unregisterMCPRegistry', async () => {
    const registry: containerDesktopAPI.MCPRegistryCreateOptions = { serverUrl: 'test-url' };
    await mcpIPCHandlerTest.unregisterMCPRegistry(IPC_MAIN_INVOKE_EVENT, registry);

    expect(MCP_REGISTRIES.unregisterMCPRegistry).toHaveBeenCalledExactlyOnceWith(registry, true);
  });
});

describe('MCPIPCHandler#createMCPRegistry', () => {
  test('should call MCPRegistries.createRegistry', async () => {
    const registryOptions: containerDesktopAPI.MCPRegistryCreateOptions = { serverUrl: 'test-url' };
    await mcpIPCHandlerTest.createMCPRegistry(IPC_MAIN_INVOKE_EVENT, registryOptions);

    expect(MCP_REGISTRIES.createRegistry).toHaveBeenCalledExactlyOnceWith(registryOptions);
  });
});

describe('MCPIPCHandler#collectMCPStatuses', () => {
  test('should call MCPStatuses.collect', async () => {
    await mcpIPCHandlerTest.collectMCPStatuses();

    expect(MCP_STATUSES.collect).toHaveBeenCalledOnce();
  });
});

describe('MCPIPCHandler#startMCP', () => {
  test('should call MCPManager.start', async () => {
    await mcpIPCHandlerTest.startMCP(IPC_MAIN_INVOKE_EVENT, 'config-id');

    expect(MCP_MANAGER_MOCK.start).toHaveBeenCalledExactlyOnceWith('config-id');
  });
});

describe('MCPIPCHandler#stopMCP', () => {
  test('should call MCPManager.stop', async () => {
    await mcpIPCHandlerTest.stopMCP(IPC_MAIN_INVOKE_EVENT, 'config-id');

    expect(MCP_MANAGER_MOCK.stop).toHaveBeenCalledExactlyOnceWith('config-id');
  });
});

describe('MCPIPCHandler#unregisterMCP', () => {
  test('should call MCPManager.unregister', async () => {
    await mcpIPCHandlerTest.unregisterMCP(IPC_MAIN_INVOKE_EVENT, 'config-id');

    expect(MCP_MANAGER_MOCK.unregister).toHaveBeenCalledExactlyOnceWith('config-id');
  });
});

describe('MCPIPCHandler#getMCPTools', () => {
  test('should call MCPAIClients.getToolSet', async () => {
    await mcpIPCHandlerTest.getMCPTools(IPC_MAIN_INVOKE_EVENT, 'config-id');

    expect(MCP_AI_CLIENTS.getToolSet).toHaveBeenCalledExactlyOnceWith(['config-id']);
  });
});

describe('MCPIPCHandler#setupMCP', () => {
  test('should call MCPManager.registerRemote for remote type', async () => {
    const options = {
      registryURL: 'registry-url',
      serverName: 'server-name',
      serverVersion: '3.5.6',
      type: 'remote',
      index: 0,
      headers: { Authorization: { value: 'Bearer foo', variables: {} } },
    } as MCPSetupRemoteOptions;

    await mcpIPCHandlerTest.setupMCP(IPC_MAIN_INVOKE_EVENT, options);

    expect(MCP_REGISTRIES_CLIENTS.getClient).toHaveBeenCalledExactlyOnceWith('registry-url');
    expect(MCP_REGISTRY_CLIENT.getServer).toHaveBeenCalledExactlyOnceWith({
      path: {
        server_id: 'server-id',
      },
    });
    expect(MCP_MANAGER_MOCK.registerRemote).toHaveBeenCalled();
  });
});
