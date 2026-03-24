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

import { SvelteMap } from 'svelte/reactivity';
import { type Writable, writable } from 'svelte/store';

import type { AgentWorkspaceSummary } from '/@api/agent-workspace-info';

export type AgentWorkspaceStatus = 'stopped' | 'running' | 'starting' | 'stopping';

export const agentWorkspaces: Writable<AgentWorkspaceSummary[]> = writable([]);
export const agentWorkspaceStatuses = new SvelteMap<string, AgentWorkspaceStatus>();

export async function fetchAgentWorkspaces(): Promise<void> {
  const data = await window.listAgentWorkspaces();
  agentWorkspaces.set(data);
}

export async function startAgentWorkspace(id: string): Promise<void> {
  agentWorkspaceStatuses.set(id, 'starting');
  try {
    await window.startAgentWorkspace(id);
    agentWorkspaceStatuses.set(id, 'running');
  } catch (error: unknown) {
    agentWorkspaceStatuses.set(id, 'stopped');
    console.error('Failed to start agent workspace', error);
  }
}

export async function stopAgentWorkspace(id: string): Promise<void> {
  agentWorkspaceStatuses.set(id, 'stopping');
  try {
    await window.stopAgentWorkspace(id);
    agentWorkspaceStatuses.set(id, 'stopped');
  } catch (error: unknown) {
    agentWorkspaceStatuses.set(id, 'running');
    console.error('Failed to stop agent workspace', error);
  }
}

window.addEventListener('system-ready', () => {
  fetchAgentWorkspaces().catch((error: unknown) => {
    console.error('Failed to fetch agent workspaces', error);
  });
});
