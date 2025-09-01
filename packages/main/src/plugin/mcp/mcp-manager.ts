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

import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import {
  isJSONRPCRequest,
  isJSONRPCResponse,
  JSONRPCRequest,
  JSONRPCResponse,
} from '@modelcontextprotocol/sdk/types.js';
import type { DynamicToolUIPart, ToolSet } from 'ai';
import { experimental_createMCPClient } from 'ai';
import { inject, injectable, preDestroy } from 'inversify';

import type { MCPRemoteServerInfo } from '/@api/mcp/mcp-server-info.js';

import { ApiSenderType } from '../api.js';
import { MCPTransportDelegate } from './mcp-transport-delegate.js';

/**
 * experimental_createMCPClient return `Promise<MCPClient>` but they did not exported this type...
 */
type ExtractedMCPClient = Awaited<ReturnType<typeof experimental_createMCPClient>>;

// Exchanges are represented as DynamicToolUIPart so the renderer can display them directly
export type MCPMessageExchange = DynamicToolUIPart;

function JSONRPCRequest2UIPart(message: JSONRPCRequest): DynamicToolUIPart {
  const rawParams: unknown = (message as { params?: unknown }).params;
  let toolName = 'unknown';
  let inputArg: unknown = undefined;
  if (rawParams && typeof rawParams === 'object') {
    const p = rawParams as Record<string, unknown>;
    if (typeof p['name'] === 'string') {
      toolName = p['name'] as string;
    }
    inputArg = (p as Record<string, unknown>)['arguments'];
  }
  const toolCallId = String(message.id);
  return {
    type: 'dynamic-tool',
    state: 'input-available',
    toolCallId,
    toolName,
    input: inputArg,
  };
}

@injectable()
export class MCPManager implements AsyncDisposable {
  /**
   * Stores all JSON-RPC message exchanges per MCP client key.
   */
  #exchanges: Map<string, Array<MCPMessageExchange>> = new Map<string, Array<MCPMessageExchange>>();
  #client: Map<string, ExtractedMCPClient> = new Map<string, ExtractedMCPClient>();

  #mcps: MCPRemoteServerInfo[] = [];

  constructor(
    @inject(ApiSenderType) private apiSender: ApiSenderType,
  ) {}

  /**
   * Cleanup all clients
   */
  @preDestroy()
  async [Symbol.asyncDispose](): Promise<void> {
    await Promise.all(Array.from(this.#client.values().map(({ close }) => close())));
  }

  protected getKey(internalProviderId: string, serverId: string, remoteId: number, connectionName: string): string {
    return `${internalProviderId}:${serverId}:${remoteId}:${connectionName}`;
  }

  public get(key: string): MCPRemoteServerInfo {
    const server = this.#mcps.find(({ id }) => id === key);
    if(!server) throw new Error(`cannot find MCP server with id ${key}`);
    return server;
  }

  public decomposeKey(raw: string): {
    internalProviderId: string,
    serverId: string,
    remoteId: number,
    connectionName: string,
  } {
    const [internalProviderId, serverId, remoteId, connectionName] = raw.split(':');
    if(!internalProviderId || !serverId || !remoteId || !connectionName) throw new Error('invalid key');
    return {
      internalProviderId,
      serverId,
      remoteId: Number.parseInt(remoteId),
      connectionName,
    };
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

  public async registerMCPClient(
    internalProviderId: string,
    serverId: string,
    remoteId: number,
    connectionName: string,
    transport: Transport,
    url?: string,
  ): Promise<void> {
    const key = this.getKey(internalProviderId, serverId, remoteId, connectionName);

    // Wrap transport with delegate to record all exchanges
    const wrapped = new MCPTransportDelegate(transport, {
      onSend: (message): void => {
        if (isJSONRPCRequest(message)) {
          this.recordInput(key, message);
        }
      },
      onReceive: (message, _extra): void => {
        if (isJSONRPCResponse(message)) {
          this.recordOutput(key, message);
        }
      },
    });

    const client = await experimental_createMCPClient({ transport: wrapped });

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

  /**
   * Record an input for the given client key.
   */
  protected recordInput(key: string, message: JSONRPCRequest): void {
    if (message.method === 'tools/call') {
      const arr = this.#exchanges.get(key) ?? [];
      const part = JSONRPCRequest2UIPart(message);
      arr.push(part);
      this.#exchanges.set(key, arr);
    }
  }

  /**
   * Record an output for the given client key.
   */
  protected recordOutput(key: string, message: JSONRPCResponse): void {
    const arr = this.#exchanges.get(key) ?? [];
    const id = String(message.id);
    const exchange = arr.find(e => e.toolCallId === id);
    if (exchange) {
      // JSON-RPC response can be either result or error
      const hasResult = 'result' in message;
      const hasError = 'error' in message;
      if (hasError && message['error'] !== undefined) {
        // Wrap error in a shape that the UI component understands
        exchange.output = { isError: true, toolResult: message['error'] };
        exchange.state = 'output-available';
      } else if (hasResult) {
        exchange.output = message['result'];
        exchange.state = 'output-available';
      } else {
        // No result and no error - leave as-is
      }
    }
    this.apiSender.send('mcp-manager-update');
  }
  /**
   * Returns the list of recorded exchanges for a given client key.
   */
  public getExchanges(key: string): MCPMessageExchange[] {
    return this.#exchanges.get(key) ?? [];
  }

  init(): void {}

  public async listMCPRemoteServers(): Promise<MCPRemoteServerInfo[]> {
    return this.#mcps;
  }
}
