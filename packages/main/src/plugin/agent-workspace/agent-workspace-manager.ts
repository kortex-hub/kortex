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

import type { Disposable } from '@kortex-app/api';
import { inject, injectable, preDestroy } from 'inversify';

import { IPCHandle } from '/@/plugin/api.js';
import type {
  AgentWorkspaceCreateOptions,
  AgentWorkspaceInfo,
  AgentWorkspaceStatus,
  AgentWorkspaceSummary,
} from '/@api/agent-workspace-info.js';
import { ApiSenderType } from '/@api/api-sender/api-sender-type.js';

import {
  mockCreateWorkspace,
  mockDeleteWorkspace,
  mockGetSupportedAgents,
  mockGetWorkspaceDetail,
  mockGetWorkspaceStatus,
  mockListWorkspaces,
  mockStartWorkspace,
  mockStopWorkspace,
} from './agent-workspace-mock-data.js';

/**
 * Manages agent workspaces.
 *
 * Each public method delegates to a mock function that simulates
 * a CLI call. When the real `kortex` CLI is ready, replace the
 * mock imports with actual exec() + JSON.parse(stdout) calls
 * following the same pattern as ContributionManager / Podman finders.
 */
@injectable()
export class AgentWorkspaceManager implements Disposable {
  constructor(
    @inject(ApiSenderType)
    private apiSender: ApiSenderType,
    @inject(IPCHandle)
    private readonly ipcHandle: IPCHandle,
  ) {}

  // Future: exec('kortex', ['workspace', 'supported-agents', '--format', 'json'])
  getSupportedAgents(): string[] {
    return mockGetSupportedAgents();
  }

  // Future: exec('kortex', ['workspace', 'list', '--format', 'json'])
  list(): AgentWorkspaceSummary[] {
    return mockListWorkspaces();
  }

  // Future: exec('kortex', ['workspace', 'inspect', id, '--format', 'json'])
  get(id: string): AgentWorkspaceInfo {
    const workspace = mockGetWorkspaceDetail(id);
    if (!workspace) {
      throw new Error(`Agent workspace not found: ${id}`);
    }
    return workspace;
  }

  // Future: exec('kortex', ['workspace', 'status', id, '--format', 'json'])
  getStatus(id: string): AgentWorkspaceStatus {
    const status = mockGetWorkspaceStatus(id);
    if (!status) {
      throw new Error(`Agent workspace not found: ${id}`);
    }
    return status;
  }

  // Future: exec('kortex', ['workspace', 'create', '--format', 'json', ...])
  create(options: AgentWorkspaceCreateOptions): AgentWorkspaceInfo {
    const workspace = mockCreateWorkspace(options);
    this.apiSender.send('agent-workspace:updated');
    return workspace;
  }

  // Future: exec('kortex', ['workspace', 'start', id, '--format', 'json'])
  start(id: string): AgentWorkspaceStatus {
    const status = mockStartWorkspace(id);
    if (!status) {
      throw new Error(`Agent workspace not found: ${id}`);
    }
    this.apiSender.send('agent-workspace:updated');
    return status;
  }

  // Future: exec('kortex', ['workspace', 'stop', id, '--format', 'json'])
  stop(id: string): AgentWorkspaceStatus {
    const status = mockStopWorkspace(id);
    if (!status) {
      throw new Error(`Agent workspace not found: ${id}`);
    }
    this.apiSender.send('agent-workspace:updated');
    return status;
  }

  // Future: exec('kortex', ['workspace', 'delete', id])
  delete(id: string): void {
    if (!mockDeleteWorkspace(id)) {
      throw new Error(`Agent workspace not found: ${id}`);
    }
    this.apiSender.send('agent-workspace:updated');
  }

  init(): void {
    this.ipcHandle('agent-workspace:supportedAgents', async (): Promise<string[]> => {
      return this.getSupportedAgents();
    });

    this.ipcHandle('agent-workspace:list', async (): Promise<AgentWorkspaceSummary[]> => {
      return this.list();
    });

    this.ipcHandle('agent-workspace:get', async (_listener, id: string): Promise<AgentWorkspaceInfo> => {
      return this.get(id);
    });

    this.ipcHandle('agent-workspace:getStatus', async (_listener, id: string): Promise<AgentWorkspaceStatus> => {
      return this.getStatus(id);
    });

    this.ipcHandle(
      'agent-workspace:create',
      async (_listener, options: AgentWorkspaceCreateOptions): Promise<AgentWorkspaceInfo> => {
        return this.create(options);
      },
    );

    this.ipcHandle('agent-workspace:start', async (_listener, id: string): Promise<AgentWorkspaceStatus> => {
      return this.start(id);
    });

    this.ipcHandle('agent-workspace:stop', async (_listener, id: string): Promise<AgentWorkspaceStatus> => {
      return this.stop(id);
    });

    this.ipcHandle('agent-workspace:delete', async (_listener, id: string): Promise<void> => {
      return this.delete(id);
    });
  }

  @preDestroy()
  dispose(): void {
    // no-op for now; will clean up CLI process handles if needed
  }
}
