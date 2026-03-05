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
export type AgentWorkspaceStatus = 'running' | 'stopped' | 'error';
export type FileAccessLevel = 'workspace' | 'home' | 'custom' | 'full';

export interface AgentWorkspaceInfo {
  id: string;
  name: string;
  description: string;
  agent: AgentType;
  model: string;
  status: AgentWorkspaceStatus;
  workingDirectory: string;
  contextUsage: {
    used: number;
    total: number;
  };
  resources: {
    skills: string[];
    mcpServers: string[];
  };
  fileAccess: FileAccessLevel;
  customPaths?: string[];
  stats: {
    messages: number;
    toolCalls: number;
    filesModified: number;
    linesChanged: number;
  };
  startedAt?: string;
  createdAt: string;
}

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
