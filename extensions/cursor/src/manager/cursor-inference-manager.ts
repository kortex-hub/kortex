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

import type {
  Disposable,
  InferenceModel,
  InferenceProviderConnection,
  Provider,
  ProviderConnectionStatus,
  SecretStorage,
} from '@openkaiden/api';
import { configuration } from '@openkaiden/api';
import { MockProviderV4 } from 'ai/test';
import { inject, injectable } from 'inversify';

import { PROVIDER_ID } from '/@/cursor-extension';
import { CursorProviderSymbol, SecretStorageSymbol } from '/@/inject/symbol';

import { CursorRestHelper } from './cursor-rest-helper';

export const TOKENS_KEY = 'cursor:tokens';

export interface StoredConnection {
  id: string;
  token: string;
}

@injectable()
export class CursorInferenceManager {
  @inject(CursorProviderSymbol)
  private cursorProvider: Provider;

  @inject(SecretStorageSymbol)
  private secrets: SecretStorage;

  @inject(CursorRestHelper)
  private cursorRestHelper: CursorRestHelper;

  private connections: Map<string, Disposable> = new Map();

  async init(): Promise<void> {
    this.cursorProvider.setInferenceProviderConnectionFactory({
      connectionTypes: ['cloud'],
      llmMetadata: { name: 'cursor' },
      create: this.factory.bind(this),
    });
    await this.restoreConnections();
  }

  private async restoreConnections(): Promise<void> {
    const stored = await this.getStoredConnections();
    for (const entry of stored) {
      try {
        await this.registerInferenceProviderConnection({ id: entry.id, token: entry.token });
      } catch (err: unknown) {
        console.error('cursor: failed to restore connection', err);
      }
    }
  }

  private async getStoredConnections(): Promise<StoredConnection[]> {
    let raw: string | undefined;
    try {
      raw = await this.secrets.get(TOKENS_KEY);
    } catch (err: unknown) {
      console.error('cursor: something went wrong while trying to get tokens from secret storage', err);
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
    await config.update('cursor.connection._type', PROVIDER_ID);
    await config.update('cursor.connection.token', secretName);
  }

  private async clearConnectionConfiguration(connection: InferenceProviderConnection): Promise<void> {
    const secretName = this.getSecretName(connection.id);
    await this.secrets.delete(secretName);

    const config = configuration.getConfiguration(undefined, connection);
    await config.update('cursor.connection._type', undefined);
    await config.update('cursor.connection.token', undefined);
  }

  private async registerInferenceProviderConnection({ id, token }: { id: string; token: string }): Promise<void> {
    if (this.connections.has(id)) {
      throw new Error(`connection already exists for id ${id}`);
    }

    let status: ProviderConnectionStatus = 'unknown';
    let models: InferenceModel[] = [];

    try {
      models = await this.getCursorModels(token);
    } catch (_err: unknown) {
      console.error(_err);
      status = 'stopped';
    }

    const cursorSdk = new MockProviderV4();

    const connection: InferenceProviderConnection = {
      id,
      name: this.maskKey(token),
      type: 'cloud',
      llmMetadata: {
        name: 'cursor',
      },
      sdk: cursorSdk,
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
      const connectionDisposable = this.cursorProvider.registerInferenceProviderConnection(connection);
      this.connections.set(id, connectionDisposable);
    } catch (err: unknown) {
      await this.clearConnectionConfiguration(connection);
      throw err;
    }
  }

  private async getCursorModels(token: string): Promise<Array<{ label: string }>> {
    const items = await this.cursorRestHelper.listModels(token);
    return items.map(item => ({ label: item.id }));
  }

  private maskKey(name: string): string {
    if (!name || name.length <= 3) return name;
    return name.slice(0, 3) + '*'.repeat(name.length - 3);
  }

  private async factory(params: { [p: string]: unknown }): Promise<void> {
    const apiKey = params['cursor.factory.apiKey'];
    if (!apiKey || typeof apiKey !== 'string') throw new Error('invalid apiKey');

    const id = randomUUID();
    await this.saveConnection({ id, token: apiKey });
    await this.registerInferenceProviderConnection({ id, token: apiKey });
  }

  dispose(): void {
    for (const disposable of this.connections.values()) {
      disposable.dispose();
    }
    this.connections.clear();
  }
}
