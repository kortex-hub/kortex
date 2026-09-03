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

import { randomUUID } from 'node:crypto';

import { createMistral } from '@ai-sdk/mistral';
import { Mistral } from '@mistralai/mistralai';
import type {
  Disposable,
  InferenceModel,
  InferenceProviderConnection,
  Provider,
  ProviderConnectionStatus,
  SecretStorage,
} from '@openkaiden/api';
import { configuration } from '@openkaiden/api';
import { inject, injectable } from 'inversify';

import { MistralProviderSymbol, SecretStorageSymbol } from '/@/inject/symbol';
import { PROVIDER_ID } from '/@/mistral-extension';

export const TOKENS_KEY = 'mistral:tokens';

export interface StoredConnection {
  id: string;
  token: string;
}

@injectable()
export class MistralInferenceManager {
  @inject(MistralProviderSymbol)
  private mistralProvider: Provider;

  @inject(SecretStorageSymbol)
  private secrets: SecretStorage;

  private connections: Map<string, Disposable> = new Map();

  async init(): Promise<void> {
    this.mistralProvider.setInferenceProviderConnectionFactory({
      connectionTypes: ['cloud'],
      llmMetadata: { name: 'mistral' },
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
      console.error('Mistral: something went wrong while trying to get tokens from secret storage', err);
    }
    if (!raw) return [];

    try {
      return JSON.parse(raw) as StoredConnection[];
    } catch {
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

  private async removeConnection(id: string): Promise<void> {
    const stored = await this.getStoredConnections();
    const filtered = stored.filter(entry => entry.id !== id);
    await this.secrets.store(TOKENS_KEY, JSON.stringify(filtered));
  }

  private getSecretName(connectionId: string): string {
    return `${PROVIDER_ID}:${connectionId}:token`;
  }

  private async setConnectionConfiguration(connection: InferenceProviderConnection, token: string): Promise<void> {
    const secretName = this.getSecretName(connection.id);
    await this.secrets.store(secretName, token);

    const config = configuration.getConfiguration(undefined, connection);
    await config.update('mistral.connection._type', PROVIDER_ID);
    await config.update('mistral.connection.token', secretName);
  }

  private async clearConnectionConfiguration(connection: InferenceProviderConnection): Promise<void> {
    const secretName = this.getSecretName(connection.id);
    await this.secrets.delete(secretName);

    const config = configuration.getConfiguration('mistral.connection', connection);
    await config.update('mistral.connection._type', undefined);
    await config.update('mistral.connection.token', undefined);
  }

  private async registerInferenceProviderConnection({ id, token }: { id: string; token: string }): Promise<void> {
    if (this.connections.has(id)) {
      throw new Error(`connection already exists for id ${id}`);
    }

    const mistral = createMistral({
      apiKey: token,
    });

    let status: ProviderConnectionStatus = 'unknown';
    let models: InferenceModel[] = [];

    try {
      models = await this.getMistralModels(token);
    } catch (err: unknown) {
      status = 'stopped';
    }

    const connection: InferenceProviderConnection = {
      id,
      name: this.maskKey(token),
      type: 'cloud',
      llmMetadata: { name: 'mistral' },
      sdk: mistral,
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
      const connectionDisposable = this.mistralProvider.registerInferenceProviderConnection(connection);
      this.connections.set(id, connectionDisposable);
    } catch (err: unknown) {
      await this.clearConnectionConfiguration(connection);
      throw err;
    }
  }

  private async getMistralModels(token: string): Promise<Array<{ label: string }>> {
    const client = new Mistral({ apiKey: token });
    const response = await client.models.list();
    const models: InferenceModel[] = [];
    const ids = new Set<string>();
    for (const model of response.data ?? []) {
      if (model.type !== 'UNKNOWN' && model.id && model.capabilities.completionChat && !ids.has(model.id)) {
        models.push({ label: model.id });
        ids.add(model.id);
      }
    }
    return models;
  }

  private maskKey(name: string): string {
    if (!name || name.length <= 3) return name;
    return name.slice(0, 3) + '*'.repeat(name.length - 3);
  }

  private async factory(params: { [p: string]: unknown }): Promise<void> {
    const apiKey = params['mistral.factory.apiKey'];
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
