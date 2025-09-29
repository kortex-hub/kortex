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
import { MCPInstance, MCPManager, type MCPManagerEvent } from '@kortex-hub/mcp-manager';
import { experimental_createMCPClient, ToolSet } from 'ai';
import { inject, injectable, preDestroy } from 'inversify';

import { MCPExchanges } from '/@/plugin/mcp/mcp-exchanges.js';

/**
 * experimental_createMCPClient return `Promise<MCPClient>` but they did not exported this type...
 */
type ExtractedMCPClient = Awaited<ReturnType<typeof experimental_createMCPClient>>;

@injectable()
export class MCPAIClients implements AsyncDisposable  {
  /**
   * We use the configId as key for the clients
   * @private
   */
  #clients: Map<string, ExtractedMCPClient> = new Map<string, ExtractedMCPClient>();

  constructor(
    @inject(MCPManager)
    private readonly mcpManager: MCPManager,
    @inject(MCPExchanges)
    private readonly mcpExchanges: MCPExchanges,
  ) {}

  init(): void {
    this.mcpManager.onUpdate((event) => {
      this.onMCPManagerUpdate(event).catch(console.error);
    });
  }

  protected async onMCPManagerUpdate(event: MCPManagerEvent): Promise<void> {

    switch (event.type) {
      case 'start':
        await this.registerMCPClient(event.instance);
        break;
      case 'stop':
        await this.disposeConfig(event.configId);
        break;
    }
  }

  protected async disposeConfig(configId: string): Promise<void> {
    try {
      await this.#clients.get(configId)?.close();
    } finally {
      this.#clients.delete(configId);
    }
  }

  protected async registerMCPClient(instance: MCPInstance): Promise<void> {
    // dispose of any existing client
    if(this.#clients.has(instance.configId)) {
      await this.disposeConfig(instance.configId);
    }

    // create a delegate to record all exchanges
    const delegate = this.mcpExchanges.createMiddleware(instance);

    // create clients
    const client = await experimental_createMCPClient({ transport: delegate });
    this.#clients.set(instance.configId, client);
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
            const client = this.#clients.get(current);
            if (client) {
              accumulator.push(client);
            }
            return accumulator;
          },
          [] as Array<ExtractedMCPClient>,
        ) ?? Array.from(this.#clients.values())
      ).map(client => client.tools()),
    );

    return tools.reduce((acc, current) => {
      return { ...acc, ...current };
    }, {});
  }

  @preDestroy()
  async [Symbol.asyncDispose](): Promise<void> {
    await Promise.all(Array.from(this.#clients.values().map((mcpClient) => mcpClient.close())));
  }
}

