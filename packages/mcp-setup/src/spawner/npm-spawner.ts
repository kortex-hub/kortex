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
import { exec } from 'node:child_process';

import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';

import { MCPSpawner } from './mcp-spawner';

const NPX_COMMAND = 'npx';

export class NPMSpawner extends MCPSpawner<'npm'> {
  #disposables: Array<AsyncDisposable> = [];

  async spawn(): Promise<Transport> {
    if (!this.pack.identifier) throw new Error('missing identifier in MCP Local Server configuration');
    if (this.pack.file_sha256) {
      console.warn('specified file sha256 is not supported with npx spawner');
    }

    // build arguments
    const RUNTIME_ARGS: Array<string> = (this.pack.runtime_arguments ?? []).map(this.getArgument.bind(this));
    const PACKAGE_ARGS: Array<string> = (this.pack.package_arguments ?? []).map(this.getArgument.bind(this));

    // let's use package@version if version is specified
    const identifier = this.pack.version ? `${this.pack.identifier}@${this.pack.version}` : this.pack.identifier;

    // environments variables
    const ENVIRONMENTS = this.getEnvironments();

    const transport = new StdioClientTransport({
      command: NPX_COMMAND,
      args: [...RUNTIME_ARGS, identifier, ...PACKAGE_ARGS],
      env: ENVIRONMENTS,
    });
    this.#disposables.push({
      [Symbol.asyncDispose]: () => {
        return transport.close();
      },
    });
    return transport;
  }

  async enabled(): Promise<boolean> {
    const { promise, resolve } = Promise.withResolvers<boolean>();

    // eslint-disable-next-line sonarjs/os-command
    exec(`${NPX_COMMAND} --version`, error => {
      if (!error) {
        resolve(true);
      } else {
        resolve(false);
      }
    });

    return promise;
  }

  async [Symbol.asyncDispose](): Promise<void> {
    await Promise.allSettled(this.#disposables.map(disposable => disposable[Symbol.asyncDispose]()));
  }
}
