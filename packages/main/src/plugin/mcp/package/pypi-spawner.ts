/**********************************************************************
 * Copyright (C) 2025 Red Hat, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at *
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

import type { CommandSpec } from './mcp-spawner.js';
import { MCPSpawner } from './mcp-spawner.js';

const UVX_COMMAND = 'uvx';

/**
 * PyPiSpawner handles spawning Python-based MCP servers from PyPI packages.
 */
export class PyPiSpawner extends MCPSpawner<'pypi'> {
  #disposables: Array<IAsyncDisposable> = [];

  buildCommandSpec(): CommandSpec {
    if (!this.pack.identifier) throw new Error('missing identifier in MCP Local Server configuration');
    const packageSpec = this.pack.version ? `${this.pack.identifier}==${this.pack.version}` : this.pack.identifier;
    return {
      command: UVX_COMMAND,
      args: [...(this.pack.runtimeArguments ?? []), packageSpec, ...(this.pack.packageArguments ?? [])],
      env: this.pack.environmentVariables,
    };
  }

  async spawn(): Promise<Transport> {
    if (this.pack.fileSha256) {
      console.warn('specified file sha256 is not supported with pypi spawner');
    }
    const spec = this.buildCommandSpec();
    const transport = new StdioClientTransport(spec);
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
