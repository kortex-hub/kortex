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
import type { components } from 'mcp-registry';

export abstract class MCPSpawner<T extends string> implements AsyncDisposable {
  constructor(protected readonly pack: components['schemas']['Package'] & { registry_type: T }) {}

  abstract spawn(): Promise<Transport>;
  abstract [Symbol.asyncDispose](): PromiseLike<void>;

  protected getArgument(
    argument: components['schemas']['PositionalArgument'] | components['schemas']['NamedArgument'],
  ): string {
    if (argument.is_required && !argument.default) {
      throw new Error(
        `argument '${argument.description}' does not have a default value: user input is not yet supported`,
      );
    }

    // dealing with named argument
    if ('type' in argument && argument['type'] === 'named') {
      return `${argument.name}=${argument.default}`;
    } else {
      return `${argument.default}`;
    }
  }
}
