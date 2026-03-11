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
import type { AgentWorkspaceSummary } from '/@api/agent-workspace-info.js';

import { AgentWorkspaceManager } from './agent-workspace-manager.js';
import { mockListWorkspaces, mockRemoveWorkspace } from './agent-workspace-mock-data.js';

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

const ipcHandle: IPCHandle = vi.fn();

beforeEach(() => {
  vi.resetAllMocks();
  manager = new AgentWorkspaceManager(ipcHandle);
  manager.init();
});

describe('init', () => {
  test('registers IPC handler for list', () => {
    expect(ipcHandle).toHaveBeenCalledWith('agent-workspace:list', expect.any(Function));
  });

  test('registers IPC handler for remove', () => {
    expect(ipcHandle).toHaveBeenCalledWith('agent-workspace:remove', expect.any(Function));
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
  test('delegates to mockRemoveWorkspace with the given id', () => {
    manager.remove('ws-1');

    expect(mockRemoveWorkspace).toHaveBeenCalledWith('ws-1');
  });

  test('throws when mockRemoveWorkspace throws for unknown id', () => {
    vi.mocked(mockRemoveWorkspace).mockImplementation(() => {
      throw new Error('workspace "unknown-id" not found. Use "workspace list" to see available workspaces.');
    });

    expect(() => manager.remove('unknown-id')).toThrow('workspace "unknown-id" not found');
  });
});
