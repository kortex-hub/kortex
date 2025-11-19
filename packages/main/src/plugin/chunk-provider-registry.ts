/**********************************************************************
 * Copyright (C) 2023-2025 Red Hat, Inc.
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

import type { ChunkProvider, Disposable } from '@kortex-app/api';
import { inject, injectable } from 'inversify';

import { IDisposable } from '/@api/disposable.js';
import { ChunkProviderInfo } from '/@api/rag/chunk-provider-info.js';

import { ApiSenderType, IPCHandle } from './api.js';

@injectable()
export class ChunkProviderRegistry implements IDisposable {
  private _chunkProviders: Map<string, ChunkProvider> = new Map<string, ChunkProvider>();

  constructor(
    @inject(ApiSenderType) private apiSender: ApiSenderType,
    @inject(IPCHandle)
    private readonly ipcHandle: IPCHandle,
  ) {}
  init(): void {
    this.ipcHandle('chunk-provider-registry:getChunkProviders', async (): Promise<ChunkProviderInfo[]> => {
      return this.getChunkProviders();
    });
  }

  registerChunkProvider(extensionId: string, provider: ChunkProvider): Disposable {
    const id = `${extensionId}.${provider.name}`;
    this._chunkProviders.set(id, provider);
    this.apiSender.send('chunker-provider-update', { id });
    return {
      dispose: (): void => {
        this._chunkProviders.delete(id);
        this.apiSender.send('chunker-provider-remove', { id });
      },
    };
  }

  getChunkProviders(): ChunkProviderInfo[] {
    return Array.from(
      this._chunkProviders.entries().map(([id, { name }]) => ({
        id,
        name,
      })),
    );
  }

  dispose(): void {
    this._chunkProviders.clear();
  }
}
