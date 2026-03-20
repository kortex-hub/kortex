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

import type { Writable } from 'svelte/store';
import { get, writable } from 'svelte/store';

import type { AgentWorkspaceSummary } from '/@api/agent-workspace-info';

export type AgentWorkspaceStatus = 'stopped' | 'running' | 'starting' | 'stopping';

export const agentWorkspaces: Writable<AgentWorkspaceSummary[]> = writable([]);
export const agentWorkspaceStatuses: Writable<Map<string, AgentWorkspaceStatus>> = writable(new Map());

export async function fetchAgentWorkspaces(): Promise<void> {
  const data = await window.listAgentWorkspaces();
  agentWorkspaces.set(data);
}

export async function startAgentWorkspace(id: string): Promise<void> {
  const statuses = get(agentWorkspaceStatuses);
  statuses.set(id, 'starting');
  agentWorkspaceStatuses.set(new Map(statuses));
  try {
    await window.startAgentWorkspace(id);
    statuses.set(id, 'running');
  } catch (error: unknown) {
    statuses.set(id, 'stopped');
    console.error('Failed to start agent workspace', error);
  }
  agentWorkspaceStatuses.set(new Map(statuses));
}

export async function stopAgentWorkspace(id: string): Promise<void> {
  const statuses = get(agentWorkspaceStatuses);
  statuses.set(id, 'stopping');
  agentWorkspaceStatuses.set(new Map(statuses));
  try {
    await window.stopAgentWorkspace(id);
    statuses.set(id, 'stopped');
  } catch (error: unknown) {
    statuses.set(id, 'running');
    console.error('Failed to stop agent workspace', error);
  }
  agentWorkspaceStatuses.set(new Map(statuses));
}

window.addEventListener('system-ready', () => {
  fetchAgentWorkspaces().catch((error: unknown) => {
    console.error('Failed to fetch agent workspaces', error);
  });
});
