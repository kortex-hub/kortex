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
import { type MCPInstance, MCPManager } from '@kortex-hub/mcp-manager';
import type { components } from '@kortex-hub/mcp-registry-types';
import type { IpcMainInvokeEvent } from 'electron/main';
import { inject, injectable } from 'inversify';

import { IPCHandle } from '/@/plugin/api.js';
import { MCPAIClients } from '/@/plugin/mcp/mcp-ai-clients.js';
import { McpRegistries } from '/@/plugin/mcp/mcp-registries.js';
import { MCPRegistriesClients } from '/@/plugin/mcp/mcp-registries-clients.js';
import { MCPStatuses } from '/@/plugin/mcp/mcp-statuses.js';
import { resolveInputWithVariableResponse } from '/@/plugin/mcp/utils.js';
import type { MCPConfigInfo } from '/@api/mcp/mcp-config-info.js';
import type { MCPSetupOptions } from '/@api/mcp/mcp-setup.js';

@injectable()
export class MCPIPCHandler {
  constructor(
    @inject(IPCHandle)
    private readonly ipcHandle: IPCHandle,
    @inject(MCPManager)
    private readonly mcpManager: MCPManager,
    @inject(MCPAIClients)
    private readonly mcpAIClients: MCPAIClients,
    @inject(MCPStatuses)
    private readonly mcpStatuses: MCPStatuses,
    @inject(MCPRegistriesClients)
    private readonly mcpRegistriesClients: MCPRegistriesClients,
    @inject(McpRegistries)
    private readonly mcpRegistries: McpRegistries,
  ) {}

  init(): void {
    this.mcpRegistries.init();
    this.mcpRegistriesClients.init();
    this.mcpAIClients.init();
    this.mcpStatuses.init();

    // define IPC for MCP Registry
    this.ipcHandle('mcp-registry:getMcpRegistries', this.getMcpRegistries.bind(this));
    this.ipcHandle('mcp-registry:getMcpRegistryServers', this.getMcpRegistryServers.bind(this));
    this.ipcHandle('mcp-registry:getMCPServerDetails', this.getMCPServerDetails.bind(this));
    this.ipcHandle('mcp-registry:getMcpSuggestedRegistries', this.getMcpSuggestedRegistries.bind(this));
    this.ipcHandle('mcp-registry:unregisterMCPRegistry', this.unregisterMCPRegistry.bind(this));
    this.ipcHandle('mcp-registry:createMCPRegistry', this.createMCPRegistry.bind(this));

    // MCP Manager-related IPC methods
    this.ipcHandle('mcp-statuses:collect', this.collectMCPStatuses.bind(this));
    this.ipcHandle('mcp-manager:start', this.startMCP.bind(this));
    this.ipcHandle('mcp-manager:stop', this.stopMCP.bind(this));
    this.ipcHandle('mcp-manager:unregister', this.unregisterMCP.bind(this));
    this.ipcHandle('mcp-manager:getTools', this.getMCPTools.bind(this));
    this.ipcHandle('mcp-manager:setup', this.setupMCP.bind(this));
  }

  /**
   * MCP Registry related IPC methods
   */
  protected async getMcpRegistries(): Promise<readonly containerDesktopAPI.MCPRegistry[]> {
    return this.mcpRegistries.getRegistries();
  }

  protected async getMcpRegistryServers(
    _: IpcMainInvokeEvent,
    registryURL: string,
    cursor: string | undefined,
    limit: number | undefined,
  ): Promise<components['schemas']['ServerList']> {
    return await this.mcpRegistriesClients.getClient(registryURL).getServers({
      query: {
        cursor: cursor,
        limit: limit,
      },
    });
  }

  protected async getMCPServerDetails(
    _: IpcMainInvokeEvent,
    registryURL: string,
    serverId: string,
    version?: string,
  ): Promise<components['schemas']['ServerDetail']> {
    const client = this.mcpRegistriesClients.getClient(registryURL);
    return await client.getServer({
      query: {
        version: version,
      },
      path: {
        server_id: serverId,
      },
    });
  }

  protected async getMcpSuggestedRegistries(): Promise<containerDesktopAPI.MCPRegistrySuggestedProvider[]> {
    return this.mcpRegistries.getSuggestedRegistries();
  }

  protected async unregisterMCPRegistry(
    _: IpcMainInvokeEvent,
    registry: containerDesktopAPI.MCPRegistry,
  ): Promise<void> {
    return this.mcpRegistries.unregisterMCPRegistry(registry, true);
  }

  /**
   * MCP Statuses method
   */
  protected async collectMCPStatuses(): Promise<Array<MCPConfigInfo>> {
    return this.mcpStatuses.collect();
  }

  protected async startMCP(_: IpcMainInvokeEvent, configId: string): Promise<void> {
    await this.mcpManager.start(configId);
  }

  protected async stopMCP(_: IpcMainInvokeEvent, configId: string): Promise<void> {
    return this.mcpManager.stop(configId);
  }

  protected async unregisterMCP(_: IpcMainInvokeEvent, configId: string): Promise<void> {
    return this.mcpManager.unregister(configId);
  }

  protected async getMCPTools(
    _: IpcMainInvokeEvent,
    configId: string,
  ): Promise<Record<string, { description: string }>> {
    const tools = await this.mcpAIClients.getToolSet([configId]);

    return Object.fromEntries(
      Object.entries(tools).map(([key, value]) => [
        key,
        {
          description: value.description ?? '',
        },
      ]),
    );
  }

  protected async setupMCP(
    _: IpcMainInvokeEvent,
    registryURL: string,
    serverId: string,
    options: MCPSetupOptions,
  ): Promise<string> {
    const client = this.mcpRegistriesClients.getClient(registryURL);
    const server = await client.getServer({
      path: {
        server_id: serverId,
      },
    });

    let mcpInstance: MCPInstance;
    switch (options.type) {
      case 'remote':
        mcpInstance = await this.mcpManager.registerRemote(
          registryURL,
          server,
          options.index,
          Object.fromEntries(
            Object.entries(options.headers).map(([key, response]) => [key, resolveInputWithVariableResponse(response)]),
          ),
        );
        break;
      case 'package':
        mcpInstance = await this.mcpManager.registerPackage(
          registryURL,
          server,
          options.index,
          // runtimeArguments
          Object.fromEntries(
            Object.entries(options.runtimeArguments).map(([key, response]) => [
              key,
              resolveInputWithVariableResponse(response),
            ]),
          ),
          // packageArguments
          Object.fromEntries(
            Object.entries(options.packageArguments).map(([key, response]) => [
              key,
              resolveInputWithVariableResponse(response),
            ]),
          ),
          // environmentVariables
          Object.fromEntries(
            Object.entries(options.environmentVariables).map(([key, response]) => [
              key,
              resolveInputWithVariableResponse(response),
            ]),
          ),
        );
        break;
    }
    return mcpInstance.configId;
  }

  protected async createMCPRegistry(
    _: IpcMainInvokeEvent,
    registryCreateOptions: containerDesktopAPI.MCPRegistryCreateOptions,
  ): Promise<void> {
    await this.mcpRegistries.createRegistry(registryCreateOptions);
  }
}
