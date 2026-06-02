/**********************************************************************
 * Copyright (C) 2026 Red Hat, Inc.
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

import { createHash, randomUUID } from 'node:crypto';

import { createAnthropic } from '@ai-sdk/anthropic';
import AnthropicClient from '@anthropic-ai/sdk';
import type { Disposable, InferenceModel, Provider, ProviderConnectionStatus, SecretStorage } from '@openkaiden/api';
import { inject, injectable } from 'inversify';

import { ClaudeProviderSymbol, SecretStorageSymbol } from '/@/inject/symbol';

export const TOKENS_KEY = 'claude:tokens';

export interface StoredConnection {
  id: string;
  token: string;
}

@injectable()
export class ClaudeInferenceManager {
  @inject(ClaudeProviderSymbol)
  private claudeProvider: Provider;

  @inject(SecretStorageSymbol)
  private secrets: SecretStorage;

  private connections: Map<string, Disposable> = new Map();

  async init(): Promise<void> {
    this.claudeProvider.setInferenceProviderConnectionFactory({
      connectionTypes: ['cloud'],
      create: this.factory.bind(this),
    });
    await this.restoreConnections();
  }

  private async restoreConnections(): Promise<void> {
    const stored = await this.getStoredConnections();
    for (const entry of stored) {
      await this.registerInferenceProviderConnection({ id: entry.id, token: entry.token });
    }
  }

  private async getStoredConnections(): Promise<StoredConnection[]> {
    let raw: string | undefined;
    try {
      raw = await this.secrets.get(TOKENS_KEY);
    } catch (err: unknown) {
      console.error('Claude: something went wrong while trying to get tokens from secret storage', err);
    }
    if (!raw) return [];

    try {
      return JSON.parse(raw) as StoredConnection[];
    } catch {
      // Migrate legacy comma-separated token format
      const tokens = raw.split(',');
      const migrated: StoredConnection[] = tokens.map(token => ({ id: randomUUID(), token }));
      await this.secrets.store(TOKENS_KEY, JSON.stringify(migrated));
      return migrated;
    }
  }

  private async saveConnection(connection: StoredConnection): Promise<void> {
    const stored = await this.getStoredConnections();
    stored.push(connection);
    await this.secrets.store(TOKENS_KEY, JSON.stringify(stored));
  }

  private getTokenHash(token: string): string {
    const sha256 = createHash('sha256');
    return sha256.update(token).digest('hex');
  }

  private async removeConnection(token: string): Promise<void> {
    const stored = await this.getStoredConnections();
    const filtered = stored.filter(entry => entry.token !== token);
    await this.secrets.store(TOKENS_KEY, JSON.stringify(filtered));
  }

  private async registerInferenceProviderConnection({ id, token }: { id: string; token: string }): Promise<void> {
    const key = this.maskKey(token);
    const tokenHash = this.getTokenHash(token);

    if (this.connections.has(tokenHash)) {
      throw new Error(`connection already exists for token ${key}`);
    }

    const anthropic = createAnthropic({
      apiKey: token,
    });

    const clean = async (): Promise<void> => {
      this.connections.get(tokenHash)?.dispose();
      this.connections.delete(tokenHash);
      await this.removeConnection(token);
    };

    let status: ProviderConnectionStatus = 'unknown';
    let models: InferenceModel[] = [];

    try {
      models = await this.getAnthropicModels(token);
    } catch (err: unknown) {
      status = 'stopped';
    }

    const connectionDisposable = this.claudeProvider.registerInferenceProviderConnection({
      id,
      name: this.maskKey(token),
      type: 'cloud',
      llmMetadata: {
        name: 'anthropic',
      },
      sdk: anthropic,
      status(): ProviderConnectionStatus {
        return status;
      },
      lifecycle: {
        delete: clean.bind(this),
      },
      models,
      credentials(): Record<string, string> {
        return {
          [TOKENS_KEY]: token,
        };
      },
    });
    this.connections.set(tokenHash, connectionDisposable);
  }

  private async getAnthropicModels(token: string): Promise<Array<{ label: string }>> {
    const client = new AnthropicClient({ apiKey: token });
    const models: InferenceModel[] = [];
    for await (const model of client.models.list()) {
      if (model.id) {
        models.push({ label: model.id });
      }
    }
    return models;
  }

  private maskKey(name: string): string {
    if (!name || name.length <= 3) return name;
    return name.slice(0, 3) + '*'.repeat(name.length - 3);
  }

  private async factory(params: { [p: string]: unknown }): Promise<void> {
    const apiKey = params['claude.factory.apiKey'];
    if (!apiKey || typeof apiKey !== 'string') throw new Error('invalid apiKey');

    const id = randomUUID();
    await this.saveConnection({ id, token: apiKey });
    await this.registerInferenceProviderConnection({ id, token: apiKey });
  }

  dispose(): void {
    this.connections.forEach(disposable => disposable.dispose());
    this.connections.clear();
  }
}
