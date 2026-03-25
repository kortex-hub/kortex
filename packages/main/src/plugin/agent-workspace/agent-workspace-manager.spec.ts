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
import type {
  AgentWorkspaceConfiguration,
  AgentWorkspaceId,
  AgentWorkspaceSummary,
} from '/@api/agent-workspace-info.js';
import type { ApiSenderType } from '/@api/api-sender/api-sender-type.js';

import { AgentWorkspaceManager } from './agent-workspace-manager.js';
import {
  mockGetWorkspaceConfiguration,
  mockListWorkspaces,
  mockRemoveWorkspace,
  mockStartWorkspace,
  mockStopWorkspace,
} from './agent-workspace-mock-data.js';

vi.mock(import('./agent-workspace-mock-data.js'));

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

let manager: AgentWorkspaceManager;

const apiSender: ApiSenderType = {
  send: vi.fn(),
  receive: vi.fn(),
};
const ipcHandle: IPCHandle = vi.fn();

beforeEach(() => {
  vi.resetAllMocks();
  manager = new AgentWorkspaceManager(apiSender, ipcHandle);
  manager.init();
});

describe('init', () => {
  test('registers IPC handler for list', () => {
    expect(ipcHandle).toHaveBeenCalledWith('agent-workspace:list', expect.any(Function));
  });

  test('registers IPC handler for remove', () => {
    expect(ipcHandle).toHaveBeenCalledWith('agent-workspace:remove', expect.any(Function));
  });

  test('registers IPC handler for getConfiguration', () => {
    expect(ipcHandle).toHaveBeenCalledWith('agent-workspace:getConfiguration', expect.any(Function));
  });

  test('registers IPC handler for start', () => {
    expect(ipcHandle).toHaveBeenCalledWith('agent-workspace:start', expect.any(Function));
  });

  test('registers IPC handler for stop', () => {
    expect(ipcHandle).toHaveBeenCalledWith('agent-workspace:stop', expect.any(Function));
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
    expect(summary.paths).toHaveProperty('source');
    expect(summary.paths).toHaveProperty('configuration');
  });
});

describe('remove', () => {
  test('delegates to mockRemoveWorkspace and returns the workspace id', () => {
    const expected: AgentWorkspaceId = { id: 'ws-1' };
    vi.mocked(mockRemoveWorkspace).mockReturnValue(expected);

    const result = manager.remove('ws-1');

    expect(mockRemoveWorkspace).toHaveBeenCalledWith('ws-1');
    expect(result).toEqual(expected);
  });

  test('emits agent-workspace-update event', () => {
    vi.mocked(mockRemoveWorkspace).mockReturnValue({ id: 'ws-1' });

    manager.remove('ws-1');

    expect(apiSender.send).toHaveBeenCalledWith('agent-workspace-update');
  });

  test('throws when mockRemoveWorkspace throws for unknown id', () => {
    vi.mocked(mockRemoveWorkspace).mockImplementation(() => {
      throw new Error('workspace "unknown-id" not found. Use "workspace list" to see available workspaces.');
    });

    expect(() => manager.remove('unknown-id')).toThrow('workspace "unknown-id" not found');
  });
});

describe('getConfiguration', () => {
  test('delegates to mockGetWorkspaceConfiguration and returns the configuration', () => {
    const expected: AgentWorkspaceConfiguration = { name: 'test-workspace-1' };
    vi.mocked(mockGetWorkspaceConfiguration).mockReturnValue(expected);

    const result = manager.getConfiguration('ws-1');

    expect(mockGetWorkspaceConfiguration).toHaveBeenCalledWith('ws-1');
    expect(result).toEqual(expected);
  });

  test('throws when mockGetWorkspaceConfiguration throws for unknown id', () => {
    vi.mocked(mockGetWorkspaceConfiguration).mockImplementation(() => {
      throw new Error('workspace "unknown-id" not found. Use "workspace list" to see available workspaces.');
    });

    expect(() => manager.getConfiguration('unknown-id')).toThrow('workspace "unknown-id" not found');
  });
});

describe('start', () => {
  test('delegates to mockStartWorkspace and returns the workspace id', () => {
    const expected: AgentWorkspaceId = { id: 'ws-1' };
    vi.mocked(mockStartWorkspace).mockReturnValue(expected);

    const result = manager.start('ws-1');

    expect(mockStartWorkspace).toHaveBeenCalledWith('ws-1');
    expect(result).toEqual(expected);
  });

  test('emits agent-workspace-update event', () => {
    vi.mocked(mockStartWorkspace).mockReturnValue({ id: 'ws-1' });

    manager.start('ws-1');

    expect(apiSender.send).toHaveBeenCalledWith('agent-workspace-update');
  });

  test('throws when mockStartWorkspace throws for unknown id', () => {
    vi.mocked(mockStartWorkspace).mockImplementation(() => {
      throw new Error('workspace "unknown-id" not found. Use "workspace list" to see available workspaces.');
    });

    expect(() => manager.start('unknown-id')).toThrow('workspace "unknown-id" not found');
  });
});

describe('stop', () => {
  test('delegates to mockStopWorkspace and returns the workspace id', () => {
    const expected: AgentWorkspaceId = { id: 'ws-1' };
    vi.mocked(mockStopWorkspace).mockReturnValue(expected);

    const result = manager.stop('ws-1');

    expect(mockStopWorkspace).toHaveBeenCalledWith('ws-1');
    expect(result).toEqual(expected);
  });

  test('emits agent-workspace-update event', () => {
    vi.mocked(mockStopWorkspace).mockReturnValue({ id: 'ws-1' });

    manager.stop('ws-1');

    expect(apiSender.send).toHaveBeenCalledWith('agent-workspace-update');
  });

  test('throws when mockStopWorkspace throws for unknown id', () => {
    vi.mocked(mockStopWorkspace).mockImplementation(() => {
      throw new Error('workspace "unknown-id" not found. Use "workspace list" to see available workspaces.');
    });

    expect(() => manager.stop('unknown-id')).toThrow('workspace "unknown-id" not found');
  });
});
