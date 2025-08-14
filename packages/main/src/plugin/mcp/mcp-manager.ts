/**********************************************************************
 * Copyright (C) 2022-2025 Red Hat, Inc.
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

import type { MCPProviderConnection } from '@kortex-app/api';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { ToolSet } from 'ai';
import { experimental_createMCPClient } from 'ai';
import { inject, injectable, preDestroy } from 'inversify';

import { ProviderRegistry } from '/@/plugin/provider-registry.js';
import type { MCPRemoteServerInfo } from '/@api/mcp/mcp-server-info.js';

import { ApiSenderType } from '../api.js';

/**
 * experimental_createMCPClient return `Promise<MCPClient>` but they did not exported this type...
 */
type ExtractedMCPClient = Awaited<ReturnType<typeof experimental_createMCPClient>>;

@injectable()
export class MCPManager implements AsyncDisposable {
  #client: Map<string, ExtractedMCPClient> = new Map<string, ExtractedMCPClient>();

  #mcps: MCPRemoteServerInfo[] = [];

  constructor(
    @inject(ProviderRegistry)
    private provider: ProviderRegistry,
    @inject(ApiSenderType) private apiSender: ApiSenderType,
  ) {}

  /**
   * Cleanup all clients
   */
  @preDestroy()
  async [Symbol.asyncDispose](): Promise<void> {
    await Promise.all(Array.from(this.#client.values().map(({ close }) => close())));
  }

  protected getKey(internalProviderId: string, connectionName: string): string {
    return `${internalProviderId}:${connectionName}`;
  }

  /**
   * Must be under the form `${internalProviderId}:${connectionName}`
   * @param selected
   */
  public async getToolSet(selected: Array<string> | undefined = undefined): Promise<ToolSet> {
    const tools = await Promise.all(
      (
        selected?.reduce(
          (accumulator, current) => {
            const client = this.#client.get(current);
            if (client) {
              accumulator.push(client);
            }
            return accumulator;
          },
          [] as Array<ExtractedMCPClient>,
        ) ?? Array.from(this.#client.values())
      ).map(client => client.tools()),
    );

    return tools.reduce((acc, current) => {
      return { ...acc, ...current };
    }, {});
  }

  public async registerMCPClient(internalProviderId: string, connectionName: string, transport: Transport, url?: string): Promise<void> {
        const client = await experimental_createMCPClient({ transport});

    const key = this.getKey(internalProviderId, connectionName);

    console.log('[MCPManager] Registering MCP client for ', internalProviderId, ' with name ', connectionName);
    this.#client.set(key, client);


    const mcpRemoteServerInfo: MCPRemoteServerInfo = {
      id: key,
      name: connectionName,
      url: url ?? '',
    };
    this.#mcps.push(mcpRemoteServerInfo);

    // broadcast new items
    this.apiSender.send('mcp-manager-update');
  }


  protected async registerMCPClientConnection(internalProviderId: string, connection: MCPProviderConnection): Promise<void> {
    return this.registerMCPClient(internalProviderId, connection.name, connection.transport);

  }

  init(): void {
    console.log('[MCPManager] Init');

    // register listener for new MCP connections
    this.provider.onDidRegisterMCPConnection(async ({ providerId, connection }) => {
      const internalProviderId = this.provider.getMatchingProviderInternalId(providerId);

      await this.registerMCPClientConnection(internalProviderId, connection);
    });

    // register listener for unregistered MCP connections
    this.provider.onDidUnregisterMCPConnection(({ providerId, connectionName }) => {
      const internalProviderId = this.provider.getMatchingProviderInternalId(providerId);

      const client = this.#client.get(this.getKey(internalProviderId, connectionName));
      if (client) {
        client.close().catch(console.error);
        this.#client.delete(this.getKey(providerId, connectionName));
      }
    });

    // Get all providers
    const providers = this.provider.getProviderInfos();

    // try to register all clients
    Promise.allSettled(
      providers.flatMap(({ internalId }) => {
        const connections = this.provider.getMCPProviderConnection(internalId);
        return connections.map(connection => this.registerMCPClientConnection(internalId, connection));
      }),
    ).catch(console.error);
  }

  public async listMCPRemoteServers(): Promise<MCPRemoteServerInfo[]> {
    return this.#mcps;
  }

}
