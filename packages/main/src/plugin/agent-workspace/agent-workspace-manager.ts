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

import { readFile } from 'node:fs/promises';

import type { Disposable } from '@kortex-app/api';
import { inject, injectable, preDestroy } from 'inversify';
import { parse as parseYAML } from 'yaml';

import { IPCHandle } from '/@/plugin/api.js';
import { CliToolRegistry } from '/@/plugin/cli-tool-registry.js';
import { Exec } from '/@/plugin/util/exec.js';
import type {
  AgentWorkspaceConfiguration,
  AgentWorkspaceCreateOptions,
  AgentWorkspaceId,
  AgentWorkspaceSummary,
} from '/@api/agent-workspace-info.js';
import { ApiSenderType } from '/@api/api-sender/api-sender-type.js';

/**
 * Manages agent workspaces by delegating to the `kortex-cli` CLI.
 */
@injectable()
export class AgentWorkspaceManager implements Disposable {
  constructor(
    @inject(ApiSenderType)
    private readonly apiSender: ApiSenderType,
    @inject(IPCHandle)
    private readonly ipcHandle: IPCHandle,
    @inject(Exec)
    private readonly exec: Exec,
    @inject(CliToolRegistry)
    private readonly cliToolRegistry: CliToolRegistry,
  ) {}

  private getCliPath(): string {
    const tool = this.cliToolRegistry.getCliToolInfos().find(t => t.name === 'kortex');
    if (tool?.path) {
      return tool.path;
    }
    return 'kortex-cli';
  }

  private async execKortex<T>(args: string[], options?: { cwd?: string }): Promise<T> {
    const cliPath = this.getCliPath();
    const fullArgs = ['workspace', ...args, '--output', 'json'];
    console.log(`Executing: ${cliPath} ${fullArgs.join(' ')}`);
    try {
      const result = await this.exec.exec(cliPath, fullArgs, options);
      return JSON.parse(result.stdout) as T;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`kortex-cli failed: ${cliPath} ${fullArgs.join(' ')} — ${message}`);
      throw err;
    }
  }

  async create(options: AgentWorkspaceCreateOptions): Promise<AgentWorkspaceId> {
    const cliPath = this.getCliPath();
    const runtime = options.runtime ?? 'podman';
    const args = ['init', options.sourcePath, '--runtime', runtime, '--agent', options.agent, '--output', 'json'];
    if (options.name) {
      args.push('--name', options.name);
    }
    if (options.project) {
      args.push('--project', options.project);
    }
    console.log(`Executing: ${cliPath} ${args.join(' ')}`);
    try {
      const result = await this.exec.exec(cliPath, args);
      const workspaceId = JSON.parse(result.stdout) as AgentWorkspaceId;
      this.apiSender.send('agent-workspace-update');
      return workspaceId;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`kortex-cli failed: ${cliPath} ${args.join(' ')} — ${message}`);
      throw err;
    }
  }

  async list(): Promise<AgentWorkspaceSummary[]> {
    const response = await this.execKortex<{ items: AgentWorkspaceSummary[] }>(['list']);
    return response.items;
  }

  async remove(id: string): Promise<AgentWorkspaceId> {
    const result = await this.execKortex<AgentWorkspaceId>(['remove', id]);
    this.apiSender.send('agent-workspace-update');
    return result;
  }

  async getConfiguration(id: string): Promise<AgentWorkspaceConfiguration> {
    const workspaces = await this.list();
    const workspace = workspaces.find(ws => ws.id === id);
    if (!workspace) {
      throw new Error(`workspace "${id}" not found. Use "workspace list" to see available workspaces.`);
    }
    const content = await readFile(workspace.paths.configuration, 'utf-8');
    return parseYAML(content) as AgentWorkspaceConfiguration;
  }

  async start(id: string): Promise<AgentWorkspaceId> {
    const result = await this.execKortex<AgentWorkspaceId>(['start', id]);
    this.apiSender.send('agent-workspace-update');
    return result;
  }

  async stop(id: string): Promise<AgentWorkspaceId> {
    const result = await this.execKortex<AgentWorkspaceId>(['stop', id]);
    this.apiSender.send('agent-workspace-update');
    return result;
  }

  init(): void {
    this.ipcHandle(
      'agent-workspace:create',
      async (_listener: unknown, options: AgentWorkspaceCreateOptions): Promise<AgentWorkspaceId> => {
        return this.create(options);
      },
    );

    this.ipcHandle('agent-workspace:list', async (): Promise<AgentWorkspaceSummary[]> => {
      return this.list();
    });

    this.ipcHandle('agent-workspace:remove', async (_listener: unknown, id: string): Promise<AgentWorkspaceId> => {
      return this.remove(id);
    });

    this.ipcHandle(
      'agent-workspace:getConfiguration',
      async (_listener: unknown, id: string): Promise<AgentWorkspaceConfiguration> => {
        return this.getConfiguration(id);
      },
    );

    this.ipcHandle('agent-workspace:start', async (_listener: unknown, id: string): Promise<AgentWorkspaceId> => {
      return this.start(id);
    });

    this.ipcHandle('agent-workspace:stop', async (_listener: unknown, id: string): Promise<AgentWorkspaceId> => {
      return this.stop(id);
    });
  }

  @preDestroy()
  dispose(): void {
    // no-op for now; will clean up CLI process handles if needed
  }
}
