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
import type { AgentWorkspaceSummary } from '/@api/agent-workspace-info.js';

import { mockListWorkspaces } from './agent-workspace-mock-data.js';

/**
 * Manages agent workspaces.
 *
 * Each public method delegates to a mock function that simulates
 * a CLI call. When the real `kortex` CLI is ready, replace the
 * mock imports with actual exec() + JSON.parse(stdout) calls.
 */
@injectable()
export class AgentWorkspaceManager implements Disposable {
  constructor(
    @inject(IPCHandle)
    private readonly ipcHandle: IPCHandle,
  ) {}

  // Future: exec('kortex', ['workspace', 'list', '--format', 'json'])
  list(): AgentWorkspaceSummary[] {
    return mockListWorkspaces();
  }

  init(): void {
    this.ipcHandle('agent-workspace:list', async (): Promise<AgentWorkspaceSummary[]> => {
      return this.list();
    });
  }

  @preDestroy()
  dispose(): void {
    // no-op for now; will clean up CLI process handles if needed
  }
}
