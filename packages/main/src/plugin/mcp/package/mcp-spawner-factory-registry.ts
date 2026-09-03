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
import type { MCPSpawner, ResolvedServerPackage, WorkspaceRequirements } from './mcp-spawner.js';
import type { MCPSpawnerFactory } from './mcp-spawner-factory.js';
import { NPMSpawner } from './npm-spawner.js';
import { PyPiSpawner } from './pypi-spawner.js';

export class MCPSpawnerFactoryRegistry {
  #factories = new Map<string, MCPSpawnerFactory>();

  register(registryType: string, factory: MCPSpawnerFactory): void {
    this.#factories.set(registryType, factory);
  }

  get(registryType: string): MCPSpawnerFactory | undefined {
    return this.#factories.get(registryType);
  }

  getByCommand(command: string): MCPSpawnerFactory | undefined {
    for (const factory of this.#factories.values()) {
      if (factory.command === command) return factory;
    }
    return undefined;
  }
}

export const mcpSpawnerFactoryRegistry = new MCPSpawnerFactoryRegistry();

mcpSpawnerFactoryRegistry.register('npm', {
  command: NPMSpawner.command,
  getWorkspaceRequirements: (): WorkspaceRequirements => NPMSpawner.getWorkspaceRequirements(),
  create: (pack: ResolvedServerPackage): MCPSpawner =>
    new NPMSpawner(pack as ResolvedServerPackage & { registryType: 'npm' }),
});

mcpSpawnerFactoryRegistry.register('pypi', {
  command: PyPiSpawner.command,
  getWorkspaceRequirements: (): WorkspaceRequirements => PyPiSpawner.getWorkspaceRequirements(),
  create: (pack: ResolvedServerPackage): MCPSpawner =>
    new PyPiSpawner(pack as ResolvedServerPackage & { registryType: 'pypi' }),
});
