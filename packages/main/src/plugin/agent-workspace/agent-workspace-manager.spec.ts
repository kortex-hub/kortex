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

import { beforeEach, describe, expect, test, vi } from 'vitest';

import type { IPCHandle } from '/@/plugin/api.js';
import type { AgentWorkspaceInfo, AgentWorkspaceStatus, AgentWorkspaceSummary } from '/@api/agent-workspace-info.js';
import type { ApiSenderType } from '/@api/api-sender/api-sender-type.js';

import { AgentWorkspaceManager } from './agent-workspace-manager.js';
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

vi.mock('./agent-workspace-mock-data.js', () => ({
  mockGetSupportedAgents: vi.fn(),
  mockListWorkspaces: vi.fn(),
  mockGetWorkspaceStatus: vi.fn(),
  mockGetWorkspaceDetail: vi.fn(),
  mockStartWorkspace: vi.fn(),
  mockStopWorkspace: vi.fn(),
  mockDeleteWorkspace: vi.fn(),
  mockCreateWorkspace: vi.fn(),
}));

const TEST_SUMMARIES: AgentWorkspaceSummary[] = [
  {
    id: 'ws-1',
    name: 'test-workspace-1',
    paths: { source: '/tmp/ws1', configuration: '/tmp/ws1/.kortex.yaml' },
  },
  {
    id: 'ws-2',
    name: 'test-workspace-2',
    paths: { source: '/tmp/ws2', configuration: '/tmp/ws2/.kortex.yaml' },
  },
];

const TEST_DETAIL: AgentWorkspaceInfo = {
  ...TEST_SUMMARIES[0]!,
  state: 'stopped',
  contextUsage: { used: 0, total: 200_000 },
  fileAccess: 'workspace',
  stats: { messages: 0, toolCalls: 0, filesModified: 0, linesChanged: 0 },
};

const TEST_STATUS: AgentWorkspaceStatus = {
  state: 'stopped',
  contextUsage: { used: 0, total: 200_000 },
};

let manager: AgentWorkspaceManager;

const apiSender: ApiSenderType = {
  send: vi.fn(),
  receive: vi.fn(),
};

const ipcHandle: IPCHandle = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  manager = new AgentWorkspaceManager(apiSender, ipcHandle);
  manager.init();
});

describe('init', () => {
  test('registers IPC handlers', () => {
    expect(ipcHandle).toHaveBeenCalledWith('agent-workspace:supportedAgents', expect.any(Function));
    expect(ipcHandle).toHaveBeenCalledWith('agent-workspace:list', expect.any(Function));
    expect(ipcHandle).toHaveBeenCalledWith('agent-workspace:get', expect.any(Function));
    expect(ipcHandle).toHaveBeenCalledWith('agent-workspace:getStatus', expect.any(Function));
    expect(ipcHandle).toHaveBeenCalledWith('agent-workspace:create', expect.any(Function));
    expect(ipcHandle).toHaveBeenCalledWith('agent-workspace:start', expect.any(Function));
    expect(ipcHandle).toHaveBeenCalledWith('agent-workspace:stop', expect.any(Function));
    expect(ipcHandle).toHaveBeenCalledWith('agent-workspace:delete', expect.any(Function));
  });
});

describe('getSupportedAgents', () => {
  test('delegates to mockGetSupportedAgents', () => {
    vi.mocked(mockGetSupportedAgents).mockReturnValue(['claude', 'cursor', 'goose']);

    const agents = manager.getSupportedAgents();

    expect(mockGetSupportedAgents).toHaveBeenCalled();
    expect(agents).toEqual(['claude', 'cursor', 'goose']);
  });
});

describe('list', () => {
  test('delegates to mockListWorkspaces', () => {
    vi.mocked(mockListWorkspaces).mockReturnValue(structuredClone(TEST_SUMMARIES));

    const result = manager.list();

    expect(mockListWorkspaces).toHaveBeenCalled();
    expect(result).toHaveLength(2);
    expect(result.map(s => s.id)).toEqual(['ws-1', 'ws-2']);
  });

  test('returns summaries with only CLI fields', () => {
    vi.mocked(mockListWorkspaces).mockReturnValue(structuredClone(TEST_SUMMARIES));

    const summary = manager.list()[0]!;

    expect(summary).toHaveProperty('id');
    expect(summary).toHaveProperty('name');
    expect(summary).toHaveProperty('paths');
    expect(summary).not.toHaveProperty('state');
    expect(summary).not.toHaveProperty('contextUsage');
    expect(summary).not.toHaveProperty('stats');
    expect(summary).not.toHaveProperty('fileAccess');
  });
});

describe('get', () => {
  test('delegates to mockGetWorkspaceDetail', () => {
    vi.mocked(mockGetWorkspaceDetail).mockReturnValue(structuredClone(TEST_DETAIL));

    const result = manager.get('ws-1');

    expect(mockGetWorkspaceDetail).toHaveBeenCalledWith('ws-1');
    expect(result.name).toBe('test-workspace-1');
    expect(result.state).toBe('stopped');
    expect(result.fileAccess).toBe('workspace');
    expect(result.stats).toBeDefined();
  });

  test('throws when workspace not found', () => {
    vi.mocked(mockGetWorkspaceDetail).mockReturnValue(undefined);

    expect(() => manager.get('bad-id')).toThrow('Agent workspace not found: bad-id');
  });
});

describe('getStatus', () => {
  test('delegates to mockGetWorkspaceStatus', () => {
    vi.mocked(mockGetWorkspaceStatus).mockReturnValue(structuredClone(TEST_STATUS));

    const result = manager.getStatus('ws-1');

    expect(mockGetWorkspaceStatus).toHaveBeenCalledWith('ws-1');
    expect(result.state).toBe('stopped');
    expect(result.contextUsage).toEqual({ used: 0, total: 200_000 });
  });

  test('throws when workspace not found', () => {
    vi.mocked(mockGetWorkspaceStatus).mockReturnValue(undefined);

    expect(() => manager.getStatus('bad-id')).toThrow('Agent workspace not found: bad-id');
  });
});

describe('create', () => {
  test('delegates to mockCreateWorkspace with options', () => {
    const mockResult: AgentWorkspaceInfo = {
      id: 'new-id',
      name: 'new-workspace',
      paths: { source: '/tmp/test', configuration: '/home/user/.config/kortex/workspaces/new-workspace.yaml' },
      state: 'stopped',
      contextUsage: { used: 0, total: 128_000 },
      fileAccess: 'home',
      stats: { messages: 0, toolCalls: 0, filesModified: 0, linesChanged: 0 },
    };
    vi.mocked(mockCreateWorkspace).mockReturnValue(structuredClone(mockResult));

    const options = {
      name: 'new-workspace',
      agent: 'goose',
      workingDirectory: '/tmp/test',
      fileAccess: 'home' as const,
    };

    const ws = manager.create(options);

    expect(mockCreateWorkspace).toHaveBeenCalledWith(options);
    expect(ws.name).toBe('new-workspace');
    expect(ws.state).toBe('stopped');
  });

  test('sends update event', () => {
    vi.mocked(mockCreateWorkspace).mockReturnValue(structuredClone(TEST_DETAIL));

    manager.create({ name: 'test', agent: 'claude' });
    expect(apiSender.send).toHaveBeenCalledWith('agent-workspace:updated');
  });
});

describe('start', () => {
  test('delegates to mockStartWorkspace and returns status', () => {
    const runningStatus: AgentWorkspaceStatus = {
      state: 'running',
      contextUsage: { used: 0, total: 200_000 },
      startedAt: '2026-03-01T00:00:00.000Z',
    };
    vi.mocked(mockStartWorkspace).mockReturnValue(structuredClone(runningStatus));

    const status = manager.start('ws-1');

    expect(mockStartWorkspace).toHaveBeenCalledWith('ws-1');
    expect(status.state).toBe('running');
    expect(status.startedAt).toBeDefined();
  });

  test('sends update event', () => {
    vi.mocked(mockStartWorkspace).mockReturnValue(structuredClone(TEST_STATUS));

    manager.start('ws-1');
    expect(apiSender.send).toHaveBeenCalledWith('agent-workspace:updated');
  });

  test('throws when workspace not found', () => {
    vi.mocked(mockStartWorkspace).mockReturnValue(undefined);

    expect(() => manager.start('bad-id')).toThrow('Agent workspace not found: bad-id');
  });
});

describe('stop', () => {
  test('delegates to mockStopWorkspace and returns status', () => {
    vi.mocked(mockStopWorkspace).mockReturnValue(structuredClone(TEST_STATUS));

    const status = manager.stop('ws-1');

    expect(mockStopWorkspace).toHaveBeenCalledWith('ws-1');
    expect(status.state).toBe('stopped');
  });

  test('sends update event', () => {
    vi.mocked(mockStopWorkspace).mockReturnValue(structuredClone(TEST_STATUS));

    manager.stop('ws-1');
    expect(apiSender.send).toHaveBeenCalledWith('agent-workspace:updated');
  });

  test('throws when workspace not found', () => {
    vi.mocked(mockStopWorkspace).mockReturnValue(undefined);

    expect(() => manager.stop('bad-id')).toThrow('Agent workspace not found: bad-id');
  });
});

describe('delete', () => {
  test('delegates to mockDeleteWorkspace', () => {
    vi.mocked(mockDeleteWorkspace).mockReturnValue(true);

    manager.delete('ws-1');

    expect(mockDeleteWorkspace).toHaveBeenCalledWith('ws-1');
  });

  test('sends update event', () => {
    vi.mocked(mockDeleteWorkspace).mockReturnValue(true);

    manager.delete('ws-1');
    expect(apiSender.send).toHaveBeenCalledWith('agent-workspace:updated');
  });

  test('throws when workspace not found', () => {
    vi.mocked(mockDeleteWorkspace).mockReturnValue(false);

    expect(() => manager.delete('bad-id')).toThrow('Agent workspace not found: bad-id');
  });
});
