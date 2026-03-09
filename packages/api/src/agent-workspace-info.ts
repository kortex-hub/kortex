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

import type { components } from '@kortex-hub/kortex-cli-api';

export type AgentWorkspaceState = 'running' | 'stopped' | 'error';
export type FileAccessLevel = 'workspace' | 'home' | 'custom' | 'full';

/**
 * Workspace data from the `kortex workspace list` command.
 * Matches the CLI contract exactly — fields will be added here
 * as the CLI evolves and publishes them in @kortex-hub/kortex-cli-api.
 */
export type AgentWorkspaceSummary = components['schemas']['Workspace'];

/**
 * Live-updating status: state and context/token usage.
 * This data changes frequently and can be polled independently.
 */
export interface AgentWorkspaceStatus {
  state: AgentWorkspaceState;
  contextUsage: {
    used: number;
    total: number;
  };
  startedAt?: string;
}

/**
 * Options for creating a new agent workspace.
 */
export interface AgentWorkspaceCreateOptions {
  name: string;
  description?: string;
  agent: string;
  model?: string;
  workingDirectory?: string;
  skills?: string[];
  mcpServers?: string[];
  fileAccess?: FileAccessLevel;
  customPaths?: string[];
}

/**
 * Full workspace detail combining summary, status, and detail-only fields.
 * Used by the detail page.
 */
export interface AgentWorkspaceInfo extends AgentWorkspaceSummary, AgentWorkspaceStatus {
  fileAccess?: FileAccessLevel;
  customPaths?: string[];
  stats?: {
    messages: number;
    toolCalls: number;
    filesModified: number;
    linesChanged: number;
  };
}
