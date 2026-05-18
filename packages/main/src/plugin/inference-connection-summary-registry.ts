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

import { inject, injectable, preDestroy } from 'inversify';

import { IPCHandle } from '/@/plugin/api.js';
import { ApiSenderType } from '/@api/api-sender/api-sender-type.js';
import type { IDisposable } from '/@api/disposable.js';
import type { InferenceConnectionSummary } from '/@api/model-registry-info.js';
import type { ProviderInfo } from '/@api/provider-info.js';

import { ProviderRegistry } from './provider-registry.js';

@injectable()
export class InferenceConnectionSummaryRegistry {
  private cachedData: Readonly<InferenceConnectionSummary[]> = [];
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

    this.ipcHandle(
      'inference-connection-summary-registry:getInferenceConnectionSummaries',
      async (): Promise<Readonly<InferenceConnectionSummary[]>> => {
        return this.getInferenceConnectionSummaries();
      },
    );

    this.rebuild();
  }

  getInferenceConnectionSummaries(): Readonly<InferenceConnectionSummary[]> {
    return this.cachedData;
  }

  private invalidate(): void {
    this.rebuild();
    this.apiSender.send('inference-connection-summary-registry:update');
  }

  private rebuild(): void {
    const providerInfos = this.providerRegistry.getProviderInfos();
    this.cachedData = this.buildConnectionSummaries(providerInfos);
  }

  private buildConnectionSummaries(providerInfos: ProviderInfo[]): InferenceConnectionSummary[] {
    const result: InferenceConnectionSummary[] = [];
    for (const provider of providerInfos) {
      const factoryTypes = provider.inferenceProviderConnectionCreationTypes ?? [];
      const creationDisplayName = provider.inferenceProviderConnectionCreationDisplayName ?? provider.name;
      const coveredTypes = new Set(provider.inferenceConnections.map(c => c.type));

      if (provider.inferenceConnections.length > 0) {
        const started = provider.inferenceConnections.find(c => c.status === 'started');
        // length > 0 guarantees [0] is defined
        const representative = started ?? provider.inferenceConnections[0]!;
        const totalModels = provider.inferenceConnections.reduce((sum, c) => sum + c.models.length, 0);
        result.push({
          providerName: provider.name,
          providerId: provider.id,
          providerInternalId: provider.internalId,
          connectionName: representative.name,
          connectionType: representative.type,
          status: representative.status,
          modelCount: totalModels,
          creationDisplayName,
          configurable: provider.inferenceProviderConnectionCreation,
        });
      }

      for (const type of factoryTypes.filter(t => !coveredTypes.has(t))) {
        result.push({
          providerName: provider.name,
          providerId: provider.id,
          providerInternalId: provider.internalId,
          connectionName: '',
          connectionType: type,
          status: 'not-configured',
          modelCount: 0,
          creationDisplayName,
          configurable: provider.inferenceProviderConnectionCreation,
        });
      }
    }
    return result;
  }

  @preDestroy()
  dispose(): void {
    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.disposables = [];
  }
}
