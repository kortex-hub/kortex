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

import { SecretStorage } from '@kortex-app/api';
import type { MCPConfigurations,Storage as MCPStorage } from '@kortex-hub/mcp-manager';
import { inject, injectable } from 'inversify';

import { SafeStorageRegistry } from '/@/plugin/safe-storage/safe-storage-registry.js';

const STORAGE_KEY = 'mcp:registry:configurations';

@injectable()
export class MCPPersistentStorage implements MCPStorage {
  #safeStorage: SecretStorage;

  constructor(
    @inject(SafeStorageRegistry)
    safeStorageRegistry: SafeStorageRegistry,
  ) {
    this.#safeStorage = safeStorageRegistry.getCoreStorage();
  }

  async add(config: MCPConfigurations): Promise<void> {
    const all = await this.values();
    await this.#safeStorage?.store(STORAGE_KEY, JSON.stringify([...all, config]));
  }

  async delete(configId: string): Promise<void> {
    const existingConfiguration = await this.values();
    const filtered = existingConfiguration.filter(
      ({ id }) => id !== configId,
    );
    await this.#safeStorage.store(STORAGE_KEY, JSON.stringify(filtered));
  }

  async get(configId: string): Promise<MCPConfigurations> {
    const all = await this.values();
    const config = all.find(({ id }) => id === configId);
    if(!config) throw new Error(`Configuration ${configId} not found`);
    return config;
  }

  async values(): Promise<Array<MCPConfigurations>> {
    const raw = await this.#safeStorage.get(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  }
}
