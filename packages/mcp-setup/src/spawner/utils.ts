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
import type { components } from 'mcp-registry';

import type { MCPSpawner } from './mcp-spawner';
import { NPMSpawner } from './npm-spawner';

/**
 * @private By destructuring `registry_type` and reconstructing the object, TypeScript can properly infer the narrowed type in each switch case.
 *
 * @param registry_type
 * @param rest
 */
export function getMCPSpawner({ registryType, ...rest }: components['schemas']['Package']): MCPSpawner {
  if (!registryType) throw new Error('cannot determine how to spawn package: registry_type is missing');

  switch (registryType) {
    case 'npm':
      return new NPMSpawner({
        registryType,
        ...rest,
      });
    default:
      throw new Error(`unsupported registry type: ${registryType}`);
  }
}
