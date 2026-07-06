/**********************************************************************
 * Copyright (C) 2026 Red Hat, Inc.
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

import { inject, injectable } from 'inversify';
import z from 'zod';

import { CliToolRegistry } from '/@/plugin/cli-tool-registry.js';
import { Exec } from '/@/plugin/util/exec.js';
import type { GatewayAddOptions, GatewayInfo } from '/@api/openshell-gateway-info.js';
import { GatewayInfoSchema } from '/@api/openshell-gateway-info.js';

import { OpenshellCliBase } from './openshell-cli-base.js';

/**
 * CLI wrapper for `openshell` gateway registration commands:
 *   - `openshell gateway add <endpoint>`
 *   - `openshell gateway remove [name]`
 *   - `openshell gateway select [name]`
 *   - `openshell gateway list`
 *   - `openshell status`
 */
@injectable()
export class OpenshellGatewayCli extends OpenshellCliBase {
  constructor(
    @inject(Exec)
    exec: Exec,
    @inject(CliToolRegistry)
    cliToolRegistry: CliToolRegistry,
  ) {
    super(exec, cliToolRegistry);
  }

  async addGateway(options: GatewayAddOptions): Promise<void> {
    const args = ['gateway', 'add', options.endpoint];
    if (options.name) {
      args.push('--name', options.name);
    }
    if (options.remote) {
      args.push('--remote', options.remote);
    }
    if (options.local) {
      args.push('--local');
    }
    await this.runCli(args);
  }

  async removeGateway(name?: string): Promise<void> {
    const args = ['gateway', 'remove'];
    if (name) {
      args.push(name);
    }
    await this.runCli(args);
  }

  async selectGateway(name?: string): Promise<void> {
    const args = ['gateway', 'select'];
    if (name) {
      args.push(name);
    }
    await this.runCli(args);
  }

  async listGateways(): Promise<GatewayInfo[]> {
    const data = await this.execCLI<unknown>(['gateway', 'list']);
    return z.array(GatewayInfoSchema).parse(data);
  }

  async checkEndpointStatus(endpoint: string): Promise<boolean> {
    const args = ['status', '--gateway-endpoint', endpoint];
    if (endpoint.startsWith('http://')) {
      args.push('--gateway-insecure');
    }
    try {
      await this.runCli(args, { quiet: true });
      return true;
    } catch {
      return false;
    }
  }

  async getGatewayStatus(): Promise<string> {
    const cliPath = this.getCliPath();
    try {
      const result = await this.exec.exec(cliPath, ['status']);
      return result.stdout.trim();
    } catch (err: unknown) {
      const detail = this.extractCliError(err);
      console.error(`openshell failed: ${cliPath} status — ${detail}`);
      throw new Error(detail);
    }
  }
}
