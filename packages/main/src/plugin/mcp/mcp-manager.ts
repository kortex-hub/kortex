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

import { MCPProviderConnection } from '@kortex-app/api';
import type { ToolSet } from 'ai';
import { experimental_createMCPClient } from 'ai';
import { inject, injectable } from 'inversify';

import { ProviderRegistry } from '/@/plugin/provider-registry.js';

/**
 * experimental_createMCPClient return `Promise<MCPClient>` but they did not exported this type...
 */
type ExtractedMCPClient = Awaited<ReturnType<typeof experimental_createMCPClient>>;

@injectable()
export class MCPManager implements AsyncDisposable {
  #client: Map<string, ExtractedMCPClient> = new Map<string, ExtractedMCPClient>();

  constructor(
    @inject(ProviderRegistry)
    private provider: ProviderRegistry,
  ) {}

  /**
   * Cleanup all clients
   */
  async [Symbol.asyncDispose](): Promise<void> {
    await Promise.all(Array.from(this.#client.values().map(({ close }) => close())));
  }

  protected getKey(internalProviderId: string, connectionName: string): string {
    return `${internalProviderId}:${connectionName}`;
  }

  public async getToolSet(): Promise<ToolSet> {
    const tools = await Promise.all(Array.from(this.#client.values()).map(client => client.tools()));

    return tools.reduce((acc, current) => {
      return { ...acc, ...current };
    }, {});
  }

  protected async registerMCPClient(internalProviderId: string, connection: MCPProviderConnection): Promise<void> {
    const client = await experimental_createMCPClient({ transport: connection.transport });

    console.log('[MCPManager] Registering MCP client for ', internalProviderId, ' with name ', connection.name);
    this.#client.set(this.getKey(internalProviderId, connection.name), client);
  }

  init(): void {
    console.log('[MCPManager] Init');

    // register listener for new MCP connections
    this.provider.onDidRegisterMCPConnection(async ({ providerId, connection }) => {
      const internalProviderId = this.provider.getMatchingProviderInternalId(providerId);

      await this.registerMCPClient(internalProviderId, connection);
    });

    // register listener for unregistered MCP connections
    this.provider.onDidUnregisterMCPConnection(({ providerId, connectionName }) => {
      const client = this.#client.get(this.getKey(providerId, connectionName));
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
        return connections.map(connection => this.registerMCPClient(internalId, connection));
      }),
    ).catch(console.error);
  }
}
