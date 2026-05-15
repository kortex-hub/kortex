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

import { inject, injectable } from 'inversify';

import { IPCHandle } from '/@/plugin/api.js';
import { ApiSenderType } from '/@api/api-sender/api-sender-type.js';
import type { IDisposable } from '/@api/disposable.js';
import type { CatalogModelInfo } from '/@api/model-registry-info.js';
import type { ProviderInfo } from '/@api/provider-info.js';

import { ProviderRegistry } from './provider-registry.js';

@injectable()
export class ModelRegistry {
  private cachedData: CatalogModelInfo[] = [];
  private cachedJson = '';
  private disposables: IDisposable[] = [];

  constructor(
    @inject(ProviderRegistry)
    private readonly providerRegistry: ProviderRegistry,
    @inject(ApiSenderType)
    private readonly apiSender: ApiSenderType,
    @inject(IPCHandle)
    private readonly ipcHandle: IPCHandle,
  ) {}

  init(): void {
    this.disposables.push(this.providerRegistry.onDidRegisterInferenceConnection(() => this.invalidate()));
    this.disposables.push(this.providerRegistry.onDidUnregisterInferenceConnection(() => this.invalidate()));
    this.disposables.push(this.providerRegistry.onDidUpdateProvider(() => this.invalidate()));

    this.disposables.push(this.apiSender.receive('provider-create', () => this.invalidate()));
    this.disposables.push(this.apiSender.receive('provider-delete', () => this.invalidate()));
    this.disposables.push(this.apiSender.receive('provider-change', () => this.invalidate()));

    this.ipcHandle('model-registry:getCatalogModels', async (): Promise<CatalogModelInfo[]> => {
      return this.getCatalogModels();
    });

    this.rebuild();
    this.cachedJson = JSON.stringify(this.cachedData);
  }

  getCatalogModels(): CatalogModelInfo[] {
    return this.cachedData;
  }

  private invalidate(): void {
    this.rebuild();
    const newJson = JSON.stringify(this.cachedData);
    if (newJson !== this.cachedJson) {
      this.cachedJson = newJson;
      this.apiSender.send('model-registry:update');
    }
  }

  private rebuild(): void {
    const providerInfos = this.providerRegistry.getProviderInfos();
    this.cachedData = this.buildCatalogModels(providerInfos);
  }

  private buildCatalogModels(providerInfos: ProviderInfo[]): CatalogModelInfo[] {
    const result: CatalogModelInfo[] = [];
    for (const provider of providerInfos) {
      for (const connection of provider.inferenceConnections ?? []) {
        for (const model of connection.models) {
          result.push({
            providerId: provider.id,
            providerName: provider.name,
            connectionName: connection.name,
            type: connection.type,
            llmMetadata: connection.llmMetadata,
            endpoint: connection.endpoint,
            label: model.label,
            connectionStatus: connection.status,
          });
        }
      }
    }
    return result;
  }

  dispose(): void {
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.disposables = [];
  }
}
