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
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';

import type { IAsyncDisposable } from '/@api/async-disposable.js';

import type { MCPSpawner, ResolvedServerPackage } from './mcp-spawner.js';
import { NPMSpawner } from './npm-spawner.js';
import { PyPiSpawner } from './pypi-spawner.js';

export class MCPPackage implements IAsyncDisposable {
  readonly #spawner: MCPSpawner;

  constructor(pack: ResolvedServerPackage) {
    // By destructuring `registry_type` and reconstructing the object, TypeScript can properly infer the narrowed type in each switch case.
    const { registryType, ...rest } = pack;
    if (!registryType) throw new Error('cannot determine how to spawn package: registry_type is missing');

    switch (registryType) {
      case 'npm':
        this.#spawner = new NPMSpawner({
          ...rest,
          registryType: registryType,
        });
        break;
      case 'pypi':
        this.#spawner = new PyPiSpawner({
          ...rest,
          registryType: registryType,
        });
        break;
      default:
        throw new Error(`unsupported registry type: ${pack.registryType}`);
    }
  }

  spawn(): Promise<Transport> {
    return this.#spawner.spawn();
  }

  asyncDispose(): Promise<void> {
    return this.#spawner.asyncDispose();
  }
}
