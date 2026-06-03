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

import type { RunError, RunOptions } from '@openkaiden/api';
import { inject, injectable } from 'inversify';
import z from 'zod';

import { CliToolRegistry } from '/@/plugin/cli-tool-registry.js';
import { Exec } from '/@/plugin/util/exec.js';
import type {
  CreateSandboxOptions,
  GatewayAddOptions,
  GatewayInfo,
  GatewaySandboxes,
  SandboxInfo,
} from '/@api/openshell-gateway-info.js';
import { GatewayInfoSchema, SandboxInfoSchema } from '/@api/openshell-gateway-info.js';

/**
 * Low-level wrapper around the `openshell` CLI binary.
 *
 * Sandbox commands:
 *   - `openshell sandbox create`
 *   - `openshell sandbox list`
 *   - `openshell sandbox start`
 *   - `openshell sandbox stop`
 *   - `openshell sandbox delete`
 *   - `openshell sandbox connect`
 *   - `openshell --version`
 *
 * Gateway registration commands:
 *   - `openshell gateway add <endpoint>`
 *   - `openshell gateway remove [name]`
 *   - `openshell gateway select [name]`
 *   - `openshell gateway list`
 *   - `openshell status`
 */
@injectable()
export class OpenshellCli {
  constructor(
    @inject(Exec)
    private readonly exec: Exec,
    @inject(CliToolRegistry)
    private readonly cliToolRegistry: CliToolRegistry,
  ) {}

  getCliPath(): string {
    const tool = this.cliToolRegistry.getCliToolInfos().find(t => t.name === 'openshell');
    if (tool?.path) {
      return tool.path;
    }
    return 'openshell';
  }

  private extractCliError(err: unknown): string {
    if (err instanceof Error && 'stdout' in err && typeof (err as RunError).stdout === 'string') {
      try {
        const parsed: unknown = JSON.parse((err as RunError).stdout);
        if (typeof parsed === 'object' && parsed !== null && 'error' in parsed) {
          const errorField = (parsed as { error: unknown }).error;
          if (typeof errorField === 'string' && errorField) {
            return errorField;
          }
        }
      } catch {
        // not JSON – fall through
      }
    }
    return err instanceof Error ? err.message : String(err);
  }

  async getVersion(): Promise<string> {
    const cliPath = this.getCliPath();
    try {
      const result = await this.exec.exec(cliPath, ['--version']);
      return result.stdout.trim();
    } catch (err: unknown) {
      const detail = this.extractCliError(err);
      console.error(`openshell failed: ${cliPath} --version — ${detail}`);
      throw new Error(detail);
    }
  }

  // ── sandbox commands ──────────────────────────────────────────────

  async createSandbox(options: CreateSandboxOptions = {}): Promise<void> {
    const args = ['sandbox', 'create'];
    if (options.name) {
      args.push('--name', options.name);
    }
    if (options.from) {
      args.push('--from', options.from);
    }
    if (options.gateway) {
      args.push('-g', options.gateway);
      args.push('--label', `gateway=${options.gateway}`);
    }
    if (options.gpu) {
      args.push('--gpu');
    }
    if (options.gpuDevice) {
      args.push('--gpu-device', options.gpuDevice);
    }
    if (options.cpu) {
      args.push('--cpu', options.cpu);
    }
    if (options.memory) {
      args.push('--memory', options.memory);
    }
    if (options.providers) {
      for (const provider of options.providers) {
        args.push('--provider', provider);
      }
    }
    if (options.labels) {
      for (const [key, value] of Object.entries(options.labels)) {
        args.push('--label', `${key}=${value}`);
      }
    }
    if (options.command?.length) {
      args.push('--', ...options.command);
    }
    await this.runCli(args);
  }

  async listSandboxes(gatewayName?: string): Promise<SandboxInfo[]> {
    const args = ['sandbox', 'list'];
    if (gatewayName) {
      args.push('-g', gatewayName);
    }
    const data = await this.execCLI<unknown>(args);
    return z.array(SandboxInfoSchema).parse(data);
  }

  async startSandbox(name: string): Promise<void> {
    await this.runCli(['sandbox', 'start', name]);
  }

  async stopSandbox(name: string): Promise<void> {
    await this.runCli(['sandbox', 'stop', name]);
  }

  async deleteSandbox(name: string): Promise<void> {
    await this.runCli(['sandbox', 'delete', name]);
  }

  async deleteAllSandboxes(gatewayName?: string): Promise<void> {
    const args = ['sandbox', 'delete', '--all'];
    if (gatewayName) {
      args.push('-g', gatewayName);
    }
    await this.runCli(args);
  }

  async connectSandbox(name: string): Promise<void> {
    await this.runCli(['sandbox', 'connect', name]);
  }

  async listSandboxesForGateway(gatewayName: string): Promise<GatewaySandboxes> {
    const gateways = await this.listGateways();
    const targetGateway = gateways.find(g => g.name === gatewayName);
    if (!targetGateway) {
      throw new Error(`Gateway not found: ${gatewayName}`);
    }

    const sandboxes = await this.listSandboxes(gatewayName);
    return { gateway: targetGateway, sandboxes };
  }

  async listSandboxesPerGateway(): Promise<GatewaySandboxes[]> {
    const gateways = await this.listGateways();
    if (gateways.length === 0) {
      return [];
    }

    const results: GatewaySandboxes[] = [];
    for (const gateway of gateways) {
      try {
        const sandboxes = await this.listSandboxes(gateway.name);
        results.push({ gateway, sandboxes });
      } catch (err: unknown) {
        console.warn(
          `[openshell] failed to list sandboxes for gateway ${gateway.name}: ${err instanceof Error ? err.message : String(err)}`,
        );
        results.push({ gateway, sandboxes: [] });
      }
    }

    return results;
  }

  // ── gateway registration commands ─────────────────────────────────

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

  // ── helpers ───────────────────────────────────────────────────────

  private async runCli(args: string[]): Promise<void> {
    const cliPath = this.getCliPath();
    console.log(`Executing: ${cliPath} ${args.join(' ')}`);
    try {
      await this.exec.exec(cliPath, args);
    } catch (err: unknown) {
      const detail = this.extractCliError(err);
      console.error(`openshell failed: ${cliPath} ${args.join(' ')} — ${detail}`);
      throw new Error(detail);
    }
  }

  private async execCLI<T>(args: string[], options?: RunOptions): Promise<T> {
    const cliPath = this.getCliPath();
    const fullArgs = [...args, '-o', 'json'];
    try {
      const result = await this.exec.exec(cliPath, fullArgs, options);
      return JSON.parse(result.stdout) as T;
    } catch (err: unknown) {
      const detail = this.extractCliError(err);
      console.error(`openshell failed: ${cliPath} ${fullArgs.join(' ')} — ${detail}`);
      throw new Error(detail);
    }
  }
}
