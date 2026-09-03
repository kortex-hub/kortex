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
import type { components } from '@openkaiden/mcp-registry-types';

import type { IAsyncDisposable } from '/@api/async-disposable.js';
import type { MCPCommandSpec } from '/@api/mcp/mcp-server-info.js';

export type ResolvedServerPackage = Omit<
  components['schemas']['Package'],
  'packageArguments' | 'runtimeArguments' | 'environmentVariables'
> & {
  runtimeArguments?: Array<string>;
  packageArguments?: Array<string>;
  environmentVariables?: Record<string, string>;
};

// Re-exported from the API layer so spawner internals use the same type as MCPRemoteServerInfo.
export type CommandSpec = MCPCommandSpec;

export interface WorkspaceRequirements {
  hosts: string[];
  features: Record<string, Record<string, unknown>>;
  env?: Record<string, string>;
  ensureFeatures?: (configDir: string) => Promise<void>;
}

export abstract class MCPSpawner<T extends string = string> implements IAsyncDisposable {
  constructor(protected readonly pack: ResolvedServerPackage & { registryType: T }) {}

  abstract buildCommandSpec(): CommandSpec;
  abstract spawn(): Promise<Transport>;
  abstract asyncDispose(): Promise<void>;
}
