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

import { createHash } from 'node:crypto';

import type { Disposable, InferenceModel, Provider, ProviderConnectionStatus, SecretStorage } from '@openkaiden/api';
import { MockProviderV3 } from 'ai/test';
import { inject, injectable } from 'inversify';

import { CursorProviderSymbol, SecretStorageSymbol } from '/@/inject/symbol';

import { CursorRestHelper } from './cursor-rest-helper';

export const TOKENS_KEY = 'cursor:tokens';
export const TOKEN_SEPARATOR = ',';

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
      create: this.factory.bind(this),
    });
    await this.restoreConnections();
  }

  private async restoreConnections(): Promise<void> {
    const tokens = await this.getTokens();
    for (const token of tokens) {
      try {
        await this.registerInferenceProviderConnection({ token });
      } catch (err: unknown) {
        console.error('cursor: failed to restore connection', err);
      }
    }
  }

  private async getTokens(): Promise<string[]> {
    let raw: string | undefined;
    try {
      raw = await this.secrets.get(TOKENS_KEY);
    } catch (err: unknown) {
      console.error('cursor: something went wrong while trying to get tokens from secret storage', err);
    }
    if (!raw) return [];
    return raw.split(TOKEN_SEPARATOR);
  }

  private async saveToken(token: string): Promise<void> {
    const tokens: Array<string> = await this.getTokens();
    const raw = [...tokens, token].join(TOKEN_SEPARATOR);
    await this.secrets.store(TOKENS_KEY, raw);
  }

  private getTokenHash(token: string): string {
    const sha256 = createHash('sha256');
    return sha256.update(token).digest('hex');
  }

  private async removeToken(token: string): Promise<void> {
    const tokens: Array<string> = await this.getTokens();
    const raw = tokens.filter(t => t !== token).join(TOKEN_SEPARATOR);
    await this.secrets.store(TOKENS_KEY, raw);
  }

  private async registerInferenceProviderConnection({ token }: { token: string }): Promise<void> {
    const key = this.maskKey(token);
    const tokenHash = this.getTokenHash(token);

    if (this.connections.has(tokenHash)) {
      throw new Error(`connection already exists for token ${key}`);
    }

    let status: ProviderConnectionStatus = 'unknown';
    let models: InferenceModel[] = [];

    try {
      models = await this.getCursorModels(token);
    } catch (_err: unknown) {
      console.error(_err);
      status = 'stopped';
    }

    const cursorSdk = new MockProviderV3();

    const clean = async (): Promise<void> => {
      this.connections.get(tokenHash)?.dispose();
      this.connections.delete(tokenHash);
      await this.removeToken(token);
    };

    const connectionDisposable = this.cursorProvider.registerInferenceProviderConnection({
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

    await this.saveToken(apiKey);
    await this.registerInferenceProviderConnection({ token: apiKey });
  }

  dispose(): void {
    for (const disposable of this.connections.values()) {
      disposable.dispose();
    }
    this.connections.clear();
  }
}
