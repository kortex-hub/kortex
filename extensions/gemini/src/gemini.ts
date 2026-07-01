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
import { randomUUID } from 'node:crypto';

import { createGoogle } from '@ai-sdk/google';
import { GoogleGenAI } from '@google/genai';
import type {
  Disposable,
  InferenceModel,
  InferenceProviderConnection,
  Provider,
  provider as ProviderAPI,
  ProviderConnectionStatus,
  SecretStorage,
} from '@openkaiden/api';
import { configuration } from '@openkaiden/api';

export const PROVIDER_ID = 'gemini';
export const TOKENS_KEY = 'gemini:tokens';

export interface StoredConnection {
  id: string;
  token: string;
}

export class Gemini implements Disposable {
  private provider: Provider | undefined = undefined;
  private connections: Map<string, Disposable> = new Map();
  private storageUpdateQueue: Promise<void> = Promise.resolve();

  constructor(
    private readonly providerAPI: typeof ProviderAPI,
    private readonly secrets: SecretStorage,
  ) {}

  async init(): Promise<void> {
    // create provider
    this.provider = this.providerAPI.createProvider({
      name: 'Gemini',
      status: 'unknown',
      id: PROVIDER_ID,
      images: {
        icon: './icon.png',
        logo: {
          dark: './icon.png',
          light: './icon.png',
        },
      },
    });

    // register MCP Provider connection factory
    this.provider?.setInferenceProviderConnectionFactory({
      connectionTypes: ['cloud'],
      llmMetadata: { name: 'gemini' },
      create: this.mcpFactory.bind(this),
    });

    // restore persistent connections
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
      console.error('Gemini: something went wrong while trying to get tokens from secret storage', err);
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

  private updateStoredConnections(mutate: (stored: StoredConnection[]) => StoredConnection[]): Promise<void> {
    this.storageUpdateQueue = this.storageUpdateQueue.then(async () => {
      const stored = await this.getStoredConnections();
      await this.secrets.store(TOKENS_KEY, JSON.stringify(mutate(stored)));
    });
    return this.storageUpdateQueue;
  }

  private async saveConnection(connection: StoredConnection): Promise<void> {
    await this.updateStoredConnections(stored => [...stored, connection]);
  }

  private async removeConnection(id: string): Promise<void> {
    await this.updateStoredConnections(stored => stored.filter(entry => entry.id !== id));
  }

  private getSecretName(connectionId: string): string {
    return `${PROVIDER_ID}:${connectionId}:token`;
  }

  private async setConnectionConfiguration(connection: InferenceProviderConnection, token: string): Promise<void> {
    const secretName = this.getSecretName(connection.id);
    await this.secrets.store(secretName, token);

    const config = configuration.getConfiguration(undefined, connection);
    await config.update('gemini.connection._type', PROVIDER_ID);
    await config.update('gemini.connection.GEMINI_API_KEY', secretName);
  }

  private async clearConnectionConfiguration(connection: InferenceProviderConnection): Promise<void> {
    const secretName = this.getSecretName(connection.id);
    await this.secrets.delete(secretName);

    const config = configuration.getConfiguration(undefined, connection);
    await config.update('gemini.connection._type', undefined);
    await config.update('gemini.connection.GEMINI_API_KEY', undefined);
  }

  private async registerInferenceProviderConnection({ id, token }: { id: string; token: string }): Promise<void> {
    if (!this.provider) throw new Error('cannot create MCP provider connection: provider is not initialized');

    const key = this.maskKey(token);

    if (this.connections.has(id)) {
      throw new Error(`connection already exists for token ${key}`);
    }

    const google = createGoogle({
      apiKey: token,
    });

    let status: ProviderConnectionStatus = 'unknown';
    let models: InferenceModel[] = [];

    try {
      models = await this.getGeminiModels(token);
    } catch (err: unknown) {
      status = 'stopped';
    }

    const connection: InferenceProviderConnection = {
      id,
      name: this.maskKey(token),
      type: 'cloud',
      llmMetadata: { name: 'gemini' },
      sdk: google,
      status(): ProviderConnectionStatus {
        return status;
      },
      lifecycle: {
        delete: async (): Promise<void> => {
          await this.clearConnectionConfiguration(connection);
          this.connections.get(id)?.dispose();
          this.connections.delete(id);
          await this.removeConnection(id);
        },
      },
      models,
      credentials(): Record<string, string> {
        return {
          [TOKENS_KEY]: token,
        };
      },
    };

    await this.setConnectionConfiguration(connection, token);

    try {
      const connectionDisposable = this.provider.registerInferenceProviderConnection(connection);
      this.connections.set(id, connectionDisposable);
    } catch (err: unknown) {
      await this.clearConnectionConfiguration(connection);
      throw err;
    }
  }

  private async getGeminiModels(token: string): Promise<Array<{ label: string }>> {
    const ai = new GoogleGenAI({ apiKey: token });
    const geminiModels = await ai.models.list();
    const models: InferenceModel[] = [];
    for await (const model of geminiModels) {
      if (model.version?.includes('Latest') && model.name && model.supportedActions?.includes('generateContent')) {
        const label = model.name.replace('models/', '');
        models.push({ label: label });
      }
    }
    return models;
  }

  private maskKey(name: string): string {
    if (!name || name.length <= 3) return name;
    return name.slice(0, 3) + '*'.repeat(name.length - 3);
  }

  private async mcpFactory(params: { [p: string]: unknown }): Promise<void> {
    const apiKey = params['gemini.factory.apiKey'];
    if (!apiKey || typeof apiKey !== 'string') throw new Error('invalid apiKey');

    const id = randomUUID();
    await this.saveConnection({ id, token: apiKey });
    await this.registerInferenceProviderConnection({ id, token: apiKey });
  }

  dispose(): void {
    this.provider?.dispose();
    this.connections.forEach(disposable => disposable.dispose());
    this.connections.clear();
  }
}
