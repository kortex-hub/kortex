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

import { randomUUID } from 'node:crypto';

import type { Disposable } from '@kortex-app/api';
import { inject, injectable, preDestroy } from 'inversify';

import { ApiSenderType, IPCHandle } from '/@/plugin/api.js';
import type { AgentWorkspaceCreateOptions, AgentWorkspaceInfo } from '/@api/agent-workspace-info.js';

@injectable()
export class AgentWorkspaceManager implements Disposable {
  #workspaces: Map<string, AgentWorkspaceInfo> = new Map();

  constructor(
    @inject(ApiSenderType)
    private apiSender: ApiSenderType,
    @inject(IPCHandle)
    private readonly ipcHandle: IPCHandle,
  ) {}

  loadWorkspaces(): AgentWorkspaceInfo[] {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    return [
      {
        id: randomUUID(),
        name: 'api-refactor',
        description: 'Refactor the REST API to use async handlers',
        agent: 'claude',
        model: 'claude-sonnet-4-20250514',
        status: 'running',
        workingDirectory: '/home/user/projects/backend',
        contextUsage: { used: 45_000, total: 200_000 },
        resources: {
          skills: ['kubernetes', 'code-review'],
          mcpServers: ['github', 'filesystem'],
        },
        fileAccess: 'workspace',
        stats: { messages: 24, toolCalls: 18, filesModified: 7, linesChanged: 342 },
        startedAt: tenMinutesAgo,
        createdAt: tenMinutesAgo,
      },
      {
        id: randomUUID(),
        name: 'test-suite-fix',
        description: 'Fix failing integration tests in CI pipeline',
        agent: 'claude',
        model: 'claude-sonnet-4-20250514',
        status: 'stopped',
        workingDirectory: '/home/user/projects/backend',
        contextUsage: { used: 120_000, total: 200_000 },
        resources: {
          skills: ['kubernetes'],
          mcpServers: ['github'],
        },
        fileAccess: 'workspace',
        stats: { messages: 56, toolCalls: 43, filesModified: 12, linesChanged: 891 },
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: randomUUID(),
        name: 'frontend-redesign',
        description: 'Redesign the dashboard components with new design system',
        agent: 'cursor',
        model: 'gpt-4o',
        status: 'stopped',
        workingDirectory: '/home/user/projects/frontend',
        contextUsage: { used: 80_000, total: 128_000 },
        resources: {
          skills: ['podman'],
          mcpServers: ['filesystem'],
        },
        fileAccess: 'home',
        stats: { messages: 31, toolCalls: 22, filesModified: 15, linesChanged: 1_204 },
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ];
  }

  list(): AgentWorkspaceInfo[] {
    return Array.from(this.#workspaces.values());
  }

  get(id: string): AgentWorkspaceInfo {
    const workspace = this.#workspaces.get(id);
    if (!workspace) {
      throw new Error(`Agent workspace not found: ${id}`);
    }
    return workspace;
  }

  create(options: AgentWorkspaceCreateOptions): AgentWorkspaceInfo {
    const model = options.model ?? this.getDefaultModel(options.agent);
    const workspace: AgentWorkspaceInfo = {
      id: randomUUID(),
      name: options.name,
      description: options.description ?? '',
      agent: options.agent,
      model,
      status: 'stopped',
      workingDirectory: options.workingDirectory ?? '.',
      contextUsage: { used: 0, total: this.getContextWindowSize(model) },
      resources: {
        skills: options.skills ?? [],
        mcpServers: options.mcpServers ?? [],
      },
      fileAccess: options.fileAccess ?? 'workspace',
      customPaths: options.customPaths,
      stats: { messages: 0, toolCalls: 0, filesModified: 0, linesChanged: 0 },
      createdAt: new Date().toISOString(),
    };

    this.#workspaces.set(workspace.id, workspace);
    this.apiSender.send('agent-workspace:updated');
    return workspace;
  }

  start(id: string): AgentWorkspaceInfo {
    const workspace = this.get(id);
    if (workspace.status !== 'running') {
      workspace.status = 'running';
      workspace.startedAt = new Date().toISOString();
      this.apiSender.send('agent-workspace:updated');
    }
    return workspace;
  }

  stop(id: string): AgentWorkspaceInfo {
    const workspace = this.get(id);
    if (workspace.status !== 'stopped') {
      workspace.status = 'stopped';
      this.apiSender.send('agent-workspace:updated');
    }
    return workspace;
  }

  delete(id: string): void {
    if (!this.#workspaces.has(id)) {
      throw new Error(`Agent workspace not found: ${id}`);
    }
    this.#workspaces.delete(id);
    this.apiSender.send('agent-workspace:updated');
  }

  private getDefaultModel(agent: AgentWorkspaceCreateOptions['agent']): string {
    switch (agent) {
      case 'claude':
        return 'claude-sonnet-4-20250514';
      case 'cursor':
        return 'gpt-4o';
      case 'goose':
        return 'granite-3.1';
    }
  }

  private getContextWindowSize(model: string): number {
    const contextWindows: Record<string, number> = {
      'claude-sonnet-4-20250514': 200_000,
      'gpt-4o': 128_000,
      'granite-3.1': 128_000,
    };
    return contextWindows[model] ?? 128_000;
  }

  init(): void {
    for (const ws of this.loadWorkspaces()) {
      this.#workspaces.set(ws.id, ws);
    }

    this.ipcHandle('agent-workspace:list', async (): Promise<AgentWorkspaceInfo[]> => {
      return this.list();
    });

    this.ipcHandle('agent-workspace:get', async (_listener, id: string): Promise<AgentWorkspaceInfo> => {
      return this.get(id);
    });

    this.ipcHandle(
      'agent-workspace:create',
      async (_listener, options: AgentWorkspaceCreateOptions): Promise<AgentWorkspaceInfo> => {
        return this.create(options);
      },
    );

    this.ipcHandle('agent-workspace:start', async (_listener, id: string): Promise<AgentWorkspaceInfo> => {
      return this.start(id);
    });

    this.ipcHandle('agent-workspace:stop', async (_listener, id: string): Promise<AgentWorkspaceInfo> => {
      return this.stop(id);
    });

    this.ipcHandle('agent-workspace:delete', async (_listener, id: string): Promise<void> => {
      return this.delete(id);
    });
  }

  @preDestroy()
  dispose(): void {
    this.#workspaces.clear();
  }
}
