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
import { createHash } from 'node:crypto';

import type {
  Disposable,
  Provider,
  provider as ProviderAPI,
  ProviderConnectionStatus,
  SecretStorage,
} from '@kortex-app/api';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp';

export const TOKENS_KEY = 'github-mcp:tokens';
export const TOKEN_SEPARATOR = ',';

export class GitHubMCP implements Disposable {
  private provider: Provider | undefined = undefined;
  private connections: Map<string, Disposable> = new Map();

  constructor(
    private readonly providerAPI: typeof ProviderAPI,
    private readonly secrets: SecretStorage,
  ) {}

  async init(): Promise<void> {
    // create provider
    this.provider = this.providerAPI.createProvider({
      name: 'GitHub - MCP',
      status: 'unknown',
      id: 'github-mcp',
    });

    // register MCP Provider connection factory
    this.provider?.setMCPProviderConnectionFactory({ create: this.mcpFactory.bind(this) });

    // restore persistent connections
    await this.restoreConnections();
  }

  private async restoreConnections(): Promise<void> {
    const tokens = await this.getTokens();
    for (const token of tokens) {
      await this.registerMCPProviderConnection({ token });
    }
  }

  /**
   * Get all tokens from secret storage
   * @private
   */
  private async getTokens(): Promise<string[]> {
    // get raw string from secret storage
    const raw = await this.secrets.get(TOKENS_KEY);
    // if undefined return empty array
    if (!raw) return [];
    // split raw string by token separator
    return raw.split(TOKEN_SEPARATOR);
  }

  /**
   * Save token to secret storage
   * @param token
   * @private
   */
  private async saveToken(token: string): Promise<void> {
    // get existing tokens
    const tokens: Array<string> = await this.getTokens();
    // concat new token with existing tokens
    const raw = [...tokens, token].join(TOKEN_SEPARATOR);
    // save to secret storage
    await this.secrets.store(TOKENS_KEY, raw);
  }

  private maskKey(name: string): string {
    if (!name || name.length <= 3) return name;
    return name.slice(0, 3) + '*'.repeat(name.length - 3);
  }

  private getTokenHash(token: string): string {
    const sha256 = createHash('sha256');
    return sha256.update(token).digest('hex');
  }

  private async removeToken(token: string): Promise<void> {
    // get existing tokens
    const tokens: Array<string> = await this.getTokens();
    // filter out the token
    const raw = tokens.filter(t => t !== token).join(TOKEN_SEPARATOR);
    // save to secret storage
    await this.secrets.store(TOKENS_KEY, raw);
  }

  private async registerMCPProviderConnection({ token }: { token: string }): Promise<void> {
    if (!this.provider) throw new Error('cannot create MCP provider connection: provider is not initialized');

    // create masked version of token
    const key = this.maskKey(token);

    // get hash of the token (used for Map)
    const tokenHash = this.getTokenHash(token);

    if (this.connections.has(tokenHash)) {
      throw new Error(`connection already exists for token ${key}`);
    }

    // create transport
    const transport = new StreamableHTTPClientTransport(new URL('https://api.githubcopilot.com/mcp'), {
      requestInit: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    // create a clean method
    const clean = async (): Promise<void> => {
      // dispose inference provider connection
      this.connections.get(tokenHash)?.dispose();
      // delete map entry
      this.connections.delete(tokenHash);
      // remove token from secret storage
      await this.removeToken(token);
    };

    const connectionDisposable = this.provider.registerMCPProviderConnection({
      name: key,
      transport: transport,
      status(): ProviderConnectionStatus {
        return 'unknown';
      },
      lifecycle: {
        delete: clean.bind(this),
      },
    });
    this.connections.set(tokenHash, connectionDisposable);
  }

  private async mcpFactory(params: { [p: string]: unknown }): Promise<void> {
    // extract key from params
    const apiKey = params['github-mcp.factory.apiKey'];
    if (!apiKey || typeof apiKey !== 'string') throw new Error('invalid apiKey');

    // save the key in secret storage
    await this.saveToken(apiKey);

    // use dedicated method to register connection
    await this.registerMCPProviderConnection({ token: apiKey });
  }

  dispose(): void {
    this.provider?.dispose();
    this.connections.forEach(disposable => disposable.dispose());
    this.connections.clear();
  }
}
