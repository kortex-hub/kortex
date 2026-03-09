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

import type {
  AgentWorkspaceCreateOptions,
  AgentWorkspaceInfo,
  AgentWorkspaceStatus,
  AgentWorkspaceSummary,
  FileAccessLevel,
} from '/@api/agent-workspace-info.js';

/**
 * Mock CLI responses.
 * Each function simulates a distinct `kortex` CLI command.
 * When the real CLI is integrated, each function will be replaced by
 * an actual `exec('kortex', [...])` invocation + JSON.parse(stdout).
 */

// ── Raw mock data ───────────────────────────────────────────────────

const SUMMARIES: AgentWorkspaceSummary[] = [
  {
    id: 'mock-ws-api-refactor',
    name: 'api-refactor',
    paths: {
      source: '/home/user/projects/backend',
      configuration: '/home/user/.config/kortex/workspaces/api-refactor.yaml',
    },
    description: 'Refactor the REST API to use async handlers',
    agent: 'claude',
    model: 'claude-sonnet-4-20250514',
    resources: {
      skills: ['kubernetes', 'code-review'],
      mcpServers: ['github', 'filesystem'],
    },
    createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
  },
  {
    id: 'mock-ws-test-suite',
    name: 'test-suite-fix',
    paths: {
      source: '/home/user/projects/backend',
      configuration: '/home/user/.config/kortex/workspaces/test-suite-fix.yaml',
    },
    description: 'Fix failing integration tests in CI pipeline',
    agent: 'claude',
    model: 'claude-sonnet-4-20250514',
    resources: {
      skills: ['kubernetes'],
      mcpServers: ['github'],
    },
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'mock-ws-frontend',
    name: 'frontend-redesign',
    paths: {
      source: '/home/user/projects/frontend',
      configuration: '/home/user/.config/kortex/workspaces/frontend-redesign.yaml',
    },
    description: 'Redesign the dashboard components with new design system',
    agent: 'cursor',
    model: 'gpt-4o',
    resources: {
      skills: ['podman'],
      mcpServers: ['filesystem'],
    },
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

const STATUSES: Record<string, AgentWorkspaceStatus> = {
  'mock-ws-api-refactor': {
    state: 'running',
    contextUsage: { used: 45_000, total: 200_000 },
    startedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
  },
  'mock-ws-test-suite': {
    state: 'stopped',
    contextUsage: { used: 120_000, total: 200_000 },
  },
  'mock-ws-frontend': {
    state: 'stopped',
    contextUsage: { used: 80_000, total: 128_000 },
  },
};

interface DetailFields {
  fileAccess: FileAccessLevel;
  customPaths?: string[];
  stats: {
    messages: number;
    toolCalls: number;
    filesModified: number;
    linesChanged: number;
  };
}

const DETAIL_FIELDS: Record<string, DetailFields> = {
  'mock-ws-api-refactor': {
    fileAccess: 'workspace',
    stats: { messages: 24, toolCalls: 18, filesModified: 7, linesChanged: 342 },
  },
  'mock-ws-test-suite': {
    fileAccess: 'workspace',
    stats: { messages: 56, toolCalls: 43, filesModified: 12, linesChanged: 891 },
  },
  'mock-ws-frontend': {
    fileAccess: 'home',
    stats: { messages: 31, toolCalls: 22, filesModified: 15, linesChanged: 1_204 },
  },
};

// ── Mock CLI functions ──────────────────────────────────────────────
// Future: exec('kortex', ['workspace', 'list', '--format', 'json'])

export function mockListWorkspaces(): AgentWorkspaceSummary[] {
  return structuredClone(SUMMARIES);
}

// Future: exec('kortex', ['workspace', 'status', id, '--format', 'json'])
export function mockGetWorkspaceStatus(id: string): AgentWorkspaceStatus | undefined {
  const status = STATUSES[id];
  return status ? structuredClone(status) : undefined;
}

// Future: exec('kortex', ['workspace', 'inspect', id, '--format', 'json'])
export function mockGetWorkspaceDetail(id: string): AgentWorkspaceInfo | undefined {
  const summary = SUMMARIES.find(s => s.id === id);
  const status = STATUSES[id];
  const detail = DETAIL_FIELDS[id];
  if (!summary || !status || !detail) {
    return undefined;
  }
  return structuredClone({ ...summary, ...status, ...detail });
}

// Future: exec('kortex', ['workspace', 'start', id, '--format', 'json'])
export function mockStartWorkspace(id: string): AgentWorkspaceStatus | undefined {
  const status = STATUSES[id];
  if (!status) {
    return undefined;
  }
  status.state = 'running';
  status.startedAt = new Date().toISOString();
  return structuredClone(status);
}

// Future: exec('kortex', ['workspace', 'stop', id, '--format', 'json'])
export function mockStopWorkspace(id: string): AgentWorkspaceStatus | undefined {
  const status = STATUSES[id];
  if (!status) {
    return undefined;
  }
  status.state = 'stopped';
  return structuredClone(status);
}

// Future: exec('kortex', ['workspace', 'delete', id])
export function mockDeleteWorkspace(id: string): boolean {
  const idx = SUMMARIES.findIndex(s => s.id === id);
  if (idx === -1) {
    return false;
  }
  SUMMARIES.splice(idx, 1);
  delete STATUSES[id];
  delete DETAIL_FIELDS[id];
  return true;
}

// Future: exec('kortex', ['workspace', 'create', '--format', 'json', ...])
export function mockCreateWorkspace(options: AgentWorkspaceCreateOptions): AgentWorkspaceInfo {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const source = options.workingDirectory ?? '.';

  const summary: AgentWorkspaceSummary = {
    id,
    name: options.name,
    paths: {
      source,
      configuration: `/home/user/.config/kortex/workspaces/${options.name}.yaml`,
    },
    description: options.description,
    agent: options.agent,
    model: options.model,
    resources: {
      skills: options.skills ?? [],
      mcpServers: options.mcpServers ?? [],
    },
    createdAt: now,
  };

  const status: AgentWorkspaceStatus = {
    state: 'stopped',
    contextUsage: { used: 0, total: 128_000 },
  };

  const detail: DetailFields = {
    fileAccess: options.fileAccess ?? 'workspace',
    stats: { messages: 0, toolCalls: 0, filesModified: 0, linesChanged: 0 },
  };

  SUMMARIES.push(summary);
  STATUSES[id] = status;
  DETAIL_FIELDS[id] = detail;

  return structuredClone({ ...summary, ...status, ...detail, customPaths: options.customPaths });
}
