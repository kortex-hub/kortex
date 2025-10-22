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
import type { components } from '@kortex-hub/mcp-registry-types';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';

import type { IAsyncDisposable } from '/@api/async-disposable.js';

export type ResolvedServerPackage = Omit<
  components['schemas']['Package'],
  'packageArguments' | 'runtimeArguments' | 'environmentVariables'
> & {
  runtimeArguments?: Array<string>;
  packageArguments?: Array<string>;
  environmentVariables?: Record<string, string>;
};

export abstract class MCPSpawner<T extends string = string> implements IAsyncDisposable {
  constructor(protected readonly pack: ResolvedServerPackage & { registryType: T }) {}

  abstract spawn(): Promise<Transport>;
  abstract asyncDispose(): Promise<void>;
}
