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

import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { Disposable, Provider, provider as ProviderAPI, ProviderConnectionStatus } from '@kortex-app/api';

export class OpenAI implements Disposable {
  private provider: Provider | undefined = undefined;
  private connections: Map<string, Disposable> = new Map();

  constructor(private readonly providerAPI: typeof ProviderAPI) {}

  async init(): Promise<void> {
    // create provider
    this.provider = this.providerAPI.createProvider({
      name: 'OpenAI',
      status: 'unknown',
      id: 'openai',
    });

    // register MCP Provider connection factory
    this.provider?.setInferenceProviderConnectionFactory({ create: this.inferenceFactory.bind(this) });
  }

  private getTokenHash(token: string): string {
    const sha256 = createHash('sha256');
    return sha256.update(token).digest('hex');
  }

  protected async listModels(baseURL: string, token: string): Promise<Array<{ label: string }>> {
    const res = await fetch(`${baseURL}/models`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (res.status !== 200) throw new Error('failed to list models');
    const body = await res.json();

    if (!('data' in body)) throw new Error(`malformed response from ${baseURL}`);
    if (!Array.isArray(body.data)) throw new Error(`malformed response from ${baseURL}: data is not an array`);

    return body.data.map((model: { id: string }) => ({ label: model.id }));
  }

  private async registerInferenceProviderConnection({
    token,
    baseURL,
  }: {
    token: string;
    baseURL: string;
  }): Promise<void> {
    if (!this.provider) throw new Error('cannot create MCP provider connection: provider is not initialized');

    // get hash of the token (used for Map)
    const tokenHash = this.getTokenHash(token);

    if (this.connections.has(tokenHash)) {
      throw new Error(`connection already exists for token ${key}`);
    }

    const models = await this.listModels(baseURL, token);

    // create ProviderV2
    const openai = createOpenAICompatible({
      baseURL: baseURL,
      apiKey: token,
      name: baseURL,
    });

    const connectionDisposable = this.provider.registerInferenceProviderConnection({
      name: baseURL,
      sdk: openai,
      status(): ProviderConnectionStatus {
        return 'unknown'; // if status is not unknown we cannot delete the connection
      },
      models: models,
    });
    this.connections.set(tokenHash, connectionDisposable);
  }

  private async inferenceFactory(params: { [p: string]: unknown }): Promise<void> {
    // extract key from params
    const apiKey = params['openai.factory.apiKey'];
    if (!apiKey || typeof apiKey !== 'string') throw new Error('invalid apiKey');

    const baseURL = params['openai.factory.baseURL'];
    if (!baseURL || typeof baseURL !== 'string') throw new Error('invalid baseURL');

    // use dedicated method to register connection
    await this.registerInferenceProviderConnection({
      token: apiKey,
      baseURL: baseURL,
    });
  }

  dispose(): void {
    this.provider?.dispose();
    this.connections.forEach(disposable => disposable.dispose());
    this.connections.clear();
  }
}
