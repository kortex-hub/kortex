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

import { RunOptions } from '@openkaiden/api';
import { inject, injectable } from 'inversify';
import z from 'zod';

import { CliToolRegistry } from '/@/plugin/cli-tool-registry.js';
import { OpenshellGateway } from '/@/plugin/openshell-cli/openshell-gateway.js';
import { Exec } from '/@/plugin/util/exec.js';
import {
  CreateProviderOptions,
  CreateSandboxOptions,
  GatewaySandboxes,
  OpenshellProviderInfo,
  OpenshellProviderInfoSchema,
  SandboxInfo,
  SandboxInfoSchema,
  SetInferenceOptions,
} from '/@api/openshell-gateway-info.js';

import { OpenshellCliBase } from './openshell-cli-base.js';
import { OpenshellGatewayCli } from './openshell-gateway-cli.js';

const SettingValue = z.union([z.string(), z.boolean(), z.number()]);

const OpenshellSettingsSchema = z.looseObject({
  scope: z.string(),
  settings: z.looseObject({
    agent_policy_proposals_enabled: SettingValue,
    ocsf_json_enabled: SettingValue,
    proposal_approval_mode: SettingValue,
    providers_v2_enabled: SettingValue,
  }),
  settings_revision: z.number(),
});

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
 * Policy commands:
 *   - `openshell policy update`
 *
 * Provider commands:
 *   - `openshell provider list`
 *   - `openshell provider delete <name>`
 *   - `openshell provider create`
 */
@injectable()
export class OpenshellCli extends OpenshellCliBase {
  constructor(
    @inject(Exec)
    exec: Exec,
    @inject(CliToolRegistry)
    cliToolRegistry: CliToolRegistry,
    @inject(OpenshellGatewayCli)
    private readonly openshellGatewayCli: OpenshellGatewayCli,
    @inject(OpenshellGateway)
    private readonly openshellGateway: OpenshellGateway,
  ) {
    super(exec, cliToolRegistry);
  }

  protected override async runCli(
    args: string[],
    options?: {
      redact?: boolean;
      env?: { [p: string]: string };
      quiet?: boolean;
    },
  ): Promise<void> {
    await this.openshellGateway.checkAvailable();
    return super.runCli(args, options);
  }

  protected override async execCLI<T>(args: string[], options?: RunOptions): Promise<T> {
    await this.openshellGateway.checkAvailable();
    return super.execCLI(args, options);
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
    if (options.env) {
      for (const [key, value] of Object.entries(options.env)) {
        args.push('--env', `${key}=${value}`);
      }
    }
    if (options.labels) {
      for (const [key, value] of Object.entries(options.labels)) {
        args.push('--label', `${key}=${value}`);
      }
    }
    if (options.uploads) {
      for (const upload of options.uploads) {
        args.push('--upload', `${upload.local}:${upload.remote}`);
      }
    }
    if (options.noTty) {
      args.push('--no-tty');
    }
    if (options.policy) {
      args.push('--policy', options.policy);
    }
    if (options.command?.length) {
      args.push('--', ...options.command);
    }
    await this.runCli(args, { redact: true });
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
    const gateways = await this.openshellGatewayCli.listGateways();
    const targetGateway = gateways.find(g => g.name === gatewayName);
    if (!targetGateway) {
      throw new Error(`Gateway not found: ${gatewayName}`);
    }

    const sandboxes = await this.listSandboxes(gatewayName);
    return { gateway: targetGateway, sandboxes };
  }

  async listSandboxesPerGateway(): Promise<GatewaySandboxes[]> {
    const gateways = await this.openshellGatewayCli.listGateways();
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

  // ── provider commands ──────────────────────────────────────────────

  async listProviders(): Promise<OpenshellProviderInfo[]> {
    const data = await this.execCLI<unknown>(['provider', 'list']);
    return z.array(OpenshellProviderInfoSchema).parse(data);
  }

  async deleteProvider(name: string): Promise<void> {
    await this.runCli(['provider', 'delete', name]);
  }

  async createProvider(options: CreateProviderOptions): Promise<void> {
    if (Object.keys(options.credentials).length === 0 && !options.flags?.length) {
      throw new Error('credentials must not be empty');
    }
    const args = ['provider', 'create', '--name', options.name, '--type', options.type];
    const env: Record<string, string> = options.env ?? {};
    for (const [key, value] of Object.entries(options.credentials)) {
      env[key] = value;
      args.push('--credential', key);
    }
    if (options.flags) {
      for (const flag of options.flags) {
        args.push(flag);
      }
    }
    if (options.config) {
      for (const [key, value] of Object.entries(options.config)) {
        args.push('--config', `${key}=${value}`);
      }
    }
    await this.runCli(args, { env });
  }

  async setInference(options: SetInferenceOptions): Promise<void> {
    return this.runCli(['inference', 'set', '--provider', options.provider, '--model', options.model, '--no-verify']);
  }

  async isV2ProviderEnabled(): Promise<boolean> {
    const cliPath = this.getCliPath();
    try {
      const result = await this.exec.exec(cliPath, ['settings', 'get', '--global', '--json']);
      const parsed = OpenshellSettingsSchema.parse(JSON.parse(result.stdout));
      const value = parsed.settings.providers_v2_enabled;
      return value === true || value === 'true';
    } catch {
      return false;
    }
  }

  async enableV2Provider(sandboxName: string): Promise<void> {
    return this.runCli(['settings', 'set', '--key', 'providers_v2_enabled', '--value', 'true', '--yes', sandboxName]);
  }
}
