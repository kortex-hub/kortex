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

export type AgentType = 'claude' | 'cursor' | 'goose';
export type AgentWorkspaceState = 'running' | 'stopped' | 'error';
export type FileAccessLevel = 'workspace' | 'home' | 'custom' | 'full';

/**
 * Static workspace data displayed in each card of the list view.
 *
 * Required fields (`id`, `name`, `paths`) match the current CLI output.
 * Optional fields will be populated as the CLI evolves.
 */
export interface AgentWorkspaceSummary {
  id: string;
  name: string;
  paths: {
    source: string;
    configuration: string;
  };
  description?: string;
  agent?: AgentType;
  model?: string;
  resources?: {
    skills: string[];
    mcpServers: string[];
  };
  createdAt?: string;
}

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
  agent: AgentType;
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
