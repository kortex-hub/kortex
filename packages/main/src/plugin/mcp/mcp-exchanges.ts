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
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import {
  isJSONRPCErrorResponse,
  isJSONRPCRequest,
  isJSONRPCResultResponse,
  JSONRPCRequest,
  JSONRPCResponse,
} from '@modelcontextprotocol/sdk/types.js';
import type { DynamicToolUIPart } from 'ai';
import { inject, injectable } from 'inversify';

import { ApiSenderType } from '/@/plugin/api.js';
import { MCPTransportDelegate } from '/@/plugin/mcp/mcp-transport-delegate.js';

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
export class MCPExchanges {
  /**
   * Stores all JSON-RPC message exchanges per MCP client key.
   */
  #exchanges: Map<string, Array<MCPMessageExchange>> = new Map<string, Array<MCPMessageExchange>>();

  constructor(
    @inject(ApiSenderType)
    private apiSender: ApiSenderType,
  ) {}

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

  public createMiddleware(key: string, transport: Transport): Transport {
    // Wrap transport with delegate to record all exchanges
    return new MCPTransportDelegate(transport, {
      onSend: (message): void => {
        if (isJSONRPCRequest(message)) {
          this.recordInput(key, message);
        }
      },
      onReceive: (message, _extra): void => {
        if (isJSONRPCResultResponse(message) || isJSONRPCErrorResponse(message)) {
          this.recordOutput(key, message);
        }
      },
    });
  }

  public clearExchanges(key: string): void {
    this.#exchanges.delete(key);
  }

  /**
   * Returns the list of recorded exchanges for a given client key.
   */
  public getExchanges(key: string): MCPMessageExchange[] {
    return this.#exchanges.get(key) ?? [];
  }
}
