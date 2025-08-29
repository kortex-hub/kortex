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

import type { Transport, TransportSendOptions } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { JSONRPCMessage, MessageExtraInfo } from '@modelcontextprotocol/sdk/types.js';

/**
 * A transport delegate that wraps an MCP Transport and allows intercepting
 * outgoing (send) and incoming (onmessage) JSON-RPC messages.
 */
export class MCPTransportDelegate implements Transport {
  private readonly onSendHook?: (message: JSONRPCMessage, options?: TransportSendOptions) => void;
  private readonly onReceiveHook?: (message: JSONRPCMessage, extra?: MessageExtraInfo) => void;

  // Consumers of this delegate may assign these handlers as usual
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage, extra?: MessageExtraInfo) => void;

  constructor(
    private readonly inner: Transport,
    hooks: {
      onSend?: (message: JSONRPCMessage, options?: TransportSendOptions) => void;
      onReceive?: (message: JSONRPCMessage, extra?: MessageExtraInfo) => void;
    } = {},
  ) {
    this.onSendHook = hooks.onSend;
    this.onReceiveHook = hooks.onReceive;

    // Wire inner transport callbacks to delegate and hooks
    this.inner.onmessage = (message: JSONRPCMessage, extra?: MessageExtraInfo): void => {
      try {
        this.onReceiveHook?.(message, extra);
      } catch (e) {
        // Swallow logging errors to avoid breaking transport
        // eslint-disable-next-line no-console
        console.error('[MCPTransportDelegate] onReceive hook error', e);
      }
      this.onmessage?.(message, extra);
    };

    this.inner.onerror = (error: Error): void => {
      this.onerror?.(error);
    };

    this.inner.onclose = (): void => {
      this.onclose?.();
    };
  }

  async start(): Promise<void> {
    return this.inner.start();
  }

  async send(message: JSONRPCMessage, options?: TransportSendOptions): Promise<void> {
    try {
      this.onSendHook?.(message, options);
    } catch (e) {
      // Do not prevent sending if logging fails
      console.error('[MCPTransportDelegate] onSend hook error', e);
    }
    return this.inner.send(message, options);
  }

  async close(): Promise<void> {
    return this.inner.close();
  }

  // Proxy session related fields if present on inner transport
  get sessionId(): string | undefined {
    return this.inner.sessionId;
  }
  set sessionId(id: string | undefined) {
    this.inner.sessionId = id;
  }

  setProtocolVersion?(version: string): void {
    if (this.inner.setProtocolVersion) {
      this.inner.setProtocolVersion(version);
    }
  }
}
