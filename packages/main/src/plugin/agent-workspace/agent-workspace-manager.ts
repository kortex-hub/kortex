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
import { Exec } from '/@/plugin/util/exec.js';
import type {
  AgentWorkspaceConfiguration,
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
  ) {}

  private async execKortex<T>(args: string[]): Promise<T> {
    const result = await this.exec.exec('kortex-cli', ['workspace', ...args, '--output', 'json']);
    return JSON.parse(result.stdout) as T;
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
