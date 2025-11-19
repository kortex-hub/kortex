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
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';

import type { IAsyncDisposable } from '/@api/async-disposable.js';

import { MCPSpawner } from './mcp-spawner.js';

const UVX_COMMAND = 'uvx';

export class PyPiSpawner extends MCPSpawner<'pypi'> {
  #disposables: Array<IAsyncDisposable> = [];

  async spawn(): Promise<Transport> {
    if (!this.pack.identifier) throw new Error('missing identifier in MCP Local Server configuration');
    if (this.pack.fileSha256) {
      console.warn('specified file sha256 is not supported with npx spawner');
    }

    const transport = new StdioClientTransport({
      command: UVX_COMMAND,
      args: [
        ...(this.pack.runtimeArguments ?? []),
        // let's use package@version if version is specified
        this.pack.version ? `${this.pack.identifier}@${this.pack.version}` : this.pack.identifier,
        ...(this.pack.packageArguments ?? []),
      ],
      env: this.pack.environmentVariables,
    });
    this.#disposables.push({
      asyncDispose: (): Promise<void> => {
        return transport.close();
      },
    });
    return transport;
  }

  async asyncDispose(): Promise<void> {
    await Promise.allSettled(this.#disposables.map(disposable => disposable.asyncDispose()));
  }
}
