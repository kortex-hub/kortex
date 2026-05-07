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

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { RunError, RunOptions } from '@openkaiden/api';
import type { components as workspaceComponents } from '@openkaiden/workspace-configuration';
import { inject, injectable } from 'inversify';

import { CliToolRegistry } from '/@/plugin/cli-tool-registry.js';
import type { WorkspaceRequirements } from '/@/plugin/mcp/package/mcp-spawner.js';
import { mcpSpawnerFactoryRegistry } from '/@/plugin/mcp/package/mcp-spawner-factory-registry.js';
import { Exec } from '/@/plugin/util/exec.js';
import type {
  AgentWorkspaceCreateOptions,
  AgentWorkspaceId,
  AgentWorkspaceSummary,
  CliInfo,
} from '/@api/agent-workspace-info.js';
import type { SecretCreateOptions, SecretInfo, SecretName, SecretService } from '/@api/secret-info.js';

type WorkspaceConfiguration = workspaceComponents['schemas']['WorkspaceConfiguration'];

/**
 * Low-level wrapper around the `kdn` CLI binary.
 *
 * Handles path resolution, command execution, and error parsing.
 * Injected into {@link AgentWorkspaceManager} so higher-level
 * orchestration (tasks, events, IPC) stays in the manager.
 */
@injectable()
export class KdnCli {
  constructor(
    @inject(Exec)
    private readonly exec: Exec,
    @inject(CliToolRegistry)
    private readonly cliToolRegistry: CliToolRegistry,
  ) {}

  getCliPath(): string {
    const tool = this.cliToolRegistry.getCliToolInfos().find(t => t.name === 'kdn');
    if (tool?.path) {
      return tool.path;
    }
    return 'kdn';
  }

  /**
   * Extract a meaningful error message from a kdn CLI failure.
   *
   * When invoked with `--output json`, kdn writes structured errors to stdout
   * as `{"error":"..."}`. This method parses that when available, otherwise
   * falls back to the generic error message.
   */
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

  async getInfo(): Promise<CliInfo> {
    const cliPath = this.getCliPath();
    const args = ['info', '--output', 'json'];
    console.log(`Executing: ${cliPath} ${args.join(' ')}`);
    try {
      const result = await this.exec.exec(cliPath, args);
      const info: unknown = JSON.parse(result.stdout);
      if (typeof info !== 'object' || info === null) {
        console.warn('kdn info returned non-object, falling back to defaults', result.stdout);
        return { version: '', agents: [], runtimes: [] };
      }
      return info as CliInfo;
    } catch (err: unknown) {
      const detail = this.extractCliError(err);
      console.error(`kdn failed: ${cliPath} ${args.join(' ')} — ${detail}`);
      throw new Error(detail);
    }
  }

  async createWorkspace(options: AgentWorkspaceCreateOptions): Promise<AgentWorkspaceId> {
    await this.writeWorkspaceConfig(options);

    const cliPath = this.getCliPath();
    const runtime = options.runtime ?? 'podman';
    const args = [
      'init',
      options.sourcePath,
      '--runtime',
      runtime,
      '--agent',
      options.agent,
      '--start',
      '--output',
      'json',
    ];
    if (options.model) {
      args.push('--model', options.model);
    }
    if (options.name) {
      args.push('--name', options.name);
    }
    if (options.project) {
      args.push('--project', options.project);
    }
    console.log(`Executing: ${cliPath} ${args.join(' ')}`);
    try {
      const result = await this.exec.exec(cliPath, args);
      return JSON.parse(result.stdout) as AgentWorkspaceId;
    } catch (err: unknown) {
      const detail = this.extractCliError(err);
      console.error(`kdn failed: ${cliPath} ${args.join(' ')} — ${detail}`);
      throw new Error(detail);
    }
  }

  async writeWorkspaceConfig(options: AgentWorkspaceCreateOptions): Promise<void> {
    const mcpServers = options.mcp?.servers;
    const mcpCommands = options.mcp?.commands;
    const hasSkills = !!options.skills?.length;
    const hasMcp = !!mcpServers?.length || !!mcpCommands?.length;
    const hasWsConfig = !!options.workspaceConfiguration;
    if (!hasSkills && !options.secrets?.length && !options.network && !hasMcp && !hasWsConfig) {
      return;
    }

    const configDir = join(options.sourcePath, '.kaiden');
    const configPath = join(configDir, 'workspace.json');
    await mkdir(configDir, { recursive: true });

    let existing: WorkspaceConfiguration = {};
    try {
      const content = await readFile(configPath, 'utf-8');
      existing = JSON.parse(content) as WorkspaceConfiguration;
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw err;
      }
    }

    if (hasWsConfig) {
      const wc = options.workspaceConfiguration!;
      if (wc.environment?.length) {
        const merged = [...(existing.environment ?? []), ...wc.environment];
        const seen = new Set<string>();
        existing.environment = merged.filter(e => {
          if (seen.has(e.name)) return false;
          seen.add(e.name);
          return true;
        });
      }
      if (wc.mounts?.length) {
        const merged = [...(existing.mounts ?? []), ...wc.mounts];
        const seen = new Set<string>();
        existing.mounts = merged.filter(m => {
          const key = `${m.host}::${m.target}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      }
    }

    if (hasSkills) {
      existing.skills = options.skills;
    }
    existing.network = options.network;

    const wsConfigSecrets = options.workspaceConfiguration?.secrets ?? [];
    const explicitSecrets = options.secrets ?? [];
    if (explicitSecrets.length > 0 || wsConfigSecrets.length > 0) {
      const mergedSecrets = [...new Set([...explicitSecrets, ...wsConfigSecrets])];
      existing.secrets = mergedSecrets;
    }

    if (hasMcp) {
      const reqsByCommand = new Map<string, WorkspaceRequirements | undefined>();
      for (const c of mcpCommands ?? []) {
        if (!reqsByCommand.has(c.command)) {
          reqsByCommand.set(c.command, mcpSpawnerFactoryRegistry.getByCommand(c.command)?.getWorkspaceRequirements());
        }
      }

      const mcp: WorkspaceConfiguration['mcp'] = {};
      if (mcpServers?.length) {
        mcp.servers = mcpServers.map(s => ({
          name: s.name,
          url: s.url,
          ...(s.headers && Object.keys(s.headers).length > 0 ? { headers: s.headers } : {}),
        }));
      }
      if (mcpCommands?.length) {
        mcp.commands = mcpCommands.map(c => {
          const reqs = reqsByCommand.get(c.command);
          const env = { ...reqs?.env, ...c.env };
          return {
            name: c.name,
            command: c.command,
            ...(c.args?.length ? { args: c.args } : {}),
            ...(Object.keys(env).length > 0 ? { env } : {}),
          };
        });
      }
      existing.mcp = mcp;

      const requiredHosts: string[] = [];
      for (const [, reqs] of reqsByCommand) {
        if (!reqs) continue;
        for (const [key, value] of Object.entries(reqs.features)) {
          existing.features = {
            ...existing.features,
            [key]: existing.features?.[key] ?? value,
          };
        }
        if (reqs.ensureFeatures) {
          await reqs.ensureFeatures(configDir);
        }
        requiredHosts.push(...reqs.hosts);
      }

      const network = existing.network;
      if (requiredHosts.length > 0 && network?.mode === 'deny' && Array.isArray(network.hosts)) {
        const missingHosts = requiredHosts.filter(h => !network.hosts!.includes(h));
        if (missingHosts.length > 0) {
          existing.network = {
            ...network,
            mode: 'deny',
            hosts: [...network.hosts!, ...missingHosts],
          };
        }
      }
    }

    const output = JSON.stringify(existing, undefined, 2) + '\n';
    console.log(`[KdnCli] workspace.json:\n${output}`);
    await writeFile(configPath, output, 'utf-8');
  }

  async listWorkspaces(): Promise<AgentWorkspaceSummary[]> {
    const response = await this.execCLI<{ items: AgentWorkspaceSummary[] }>(['workspace', 'list']);
    return response.items;
  }

  async removeWorkspaces(id: string): Promise<AgentWorkspaceId> {
    return this.execCLI<AgentWorkspaceId>(['workspace', 'remove', id, '--force']);
  }

  async startWorkspace(id: string): Promise<AgentWorkspaceId> {
    return this.execCLI<AgentWorkspaceId>(['workspace', 'start', id]);
  }

  async stopWorkspace(id: string): Promise<AgentWorkspaceId> {
    return this.execCLI<AgentWorkspaceId>(['workspace', 'stop', id]);
  }

  private async execCLI<T>(args: string[], options?: RunOptions): Promise<T> {
    const cliPath = this.getCliPath();
    const fullArgs = [...args, '--output', 'json'];
    try {
      const result = await this.exec.exec(cliPath, fullArgs, options);
      return JSON.parse(result.stdout) as T;
    } catch (err: unknown) {
      const detail = this.extractCliError(err);
      console.error(`kdn failed: ${cliPath} ${fullArgs.join(' ')} — ${detail}`);
      throw new Error(detail);
    }
  }

  async createSecret(options: SecretCreateOptions): Promise<SecretName> {
    const args = ['secret', 'create', options.name, '--type', options.type, '--value', options.value];
    if (options.description) {
      args.push('--description', options.description);
    }
    if (options.hosts) {
      for (const host of options.hosts) {
        args.push('--host', host);
      }
    }
    if (options.header) {
      args.push('--header', options.header);
    }
    if (options.headerTemplate) {
      args.push('--header-template', options.headerTemplate);
    }
    if (options.path) {
      args.push('--path', options.path);
    }
    if (options.envs) {
      for (const e of options.envs) {
        args.push('--env', e);
      }
    }
    return this.execCLI<SecretName>(args);
  }

  async listSecrets(): Promise<SecretInfo[]> {
    const response = await this.execCLI<{ items: SecretInfo[] }>(['secret', 'list']);
    return response.items;
  }

  async removeSecret(name: string): Promise<SecretName> {
    return this.execCLI<SecretName>(['secret', 'remove', name]);
  }

  async listServices(): Promise<SecretService[]> {
    const response = await this.execCLI<{ items: SecretService[] }>(['service', 'list']);
    return response.items;
  }
}
