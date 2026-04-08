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

import { readFile } from 'node:fs/promises';

import type { RunResult } from '@openkaiden/api';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { parse as parseYAML } from 'yaml';

import type { IPCHandle } from '/@/plugin/api.js';
import type { Proxy } from '/@/plugin/proxy.js';
import { Exec } from '/@/plugin/util/exec.js';
import type { AgentWorkspaceSummary } from '/@api/agent-workspace-info.js';
import type { ApiSenderType } from '/@api/api-sender/api-sender-type.js';

import { AgentWorkspaceManager } from './agent-workspace-manager.js';

vi.mock(import('node:fs/promises'));
vi.mock(import('yaml'));

const TEST_SUMMARIES: AgentWorkspaceSummary[] = [
  {
    id: 'ws-1',
    name: 'test-workspace-1',
    project: 'project-alpha',
    agent: 'coder-v1',
    state: 'stopped',
    model: 'gpt-4o',
    paths: { source: '/tmp/ws1', configuration: '/tmp/ws1/.kaiden.yaml' },
  },
  {
    id: 'ws-2',
    name: 'test-workspace-2',
    project: 'project-beta',
    agent: 'coder-v2',
    state: 'running',
    paths: { source: '/tmp/ws2', configuration: '/tmp/ws2/.kaiden.yaml' },
  },
];

let manager: AgentWorkspaceManager;

const apiSender: ApiSenderType = {
  send: vi.fn(),
  receive: vi.fn(),
};
const ipcHandle: IPCHandle = vi.fn();
const proxy = {
  isEnabled: vi.fn().mockReturnValue(false),
} as unknown as Proxy;
const exec = new Exec(proxy);

function mockExecResult(stdout: string): RunResult {
  return { command: 'kdn', stdout, stderr: '' };
}

beforeEach(() => {
  vi.resetAllMocks();
  manager = new AgentWorkspaceManager(apiSender, ipcHandle, exec);
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
  test('executes kdn workspace list and returns items', async () => {
    vi.spyOn(exec, 'exec').mockResolvedValue(mockExecResult(JSON.stringify({ items: TEST_SUMMARIES })));

    const result = await manager.list();

    expect(exec.exec).toHaveBeenCalledWith('kdn', ['workspace', 'list', '--output', 'json']);
    expect(result).toHaveLength(2);
    expect(result.map(s => s.id)).toEqual(['ws-1', 'ws-2']);
  });

  test('returns summaries with expected CLI fields', async () => {
    vi.spyOn(exec, 'exec').mockResolvedValue(mockExecResult(JSON.stringify({ items: TEST_SUMMARIES })));

    const summary = (await manager.list())[0]!;

    expect(summary).toHaveProperty('id');
    expect(summary).toHaveProperty('name');
    expect(summary).toHaveProperty('project');
    expect(summary).toHaveProperty('agent');
    expect(summary).toHaveProperty('state');
    expect(summary).toHaveProperty('model');
    expect(summary).toHaveProperty('paths');
    expect(summary.paths).toHaveProperty('source');
    expect(summary.paths).toHaveProperty('configuration');
  });

  test('returns summaries without model when CLI omits it', async () => {
    vi.spyOn(exec, 'exec').mockResolvedValue(mockExecResult(JSON.stringify({ items: TEST_SUMMARIES })));

    const summary = (await manager.list())[1]!;

    expect(summary.model).toBeUndefined();
  });

  test('rejects when CLI fails', async () => {
    vi.spyOn(exec, 'exec').mockRejectedValue(new Error('command not found'));

    await expect(manager.list()).rejects.toThrow('command not found');
  });
});

describe('remove', () => {
  test('executes kdn workspace remove and returns the workspace id', async () => {
    vi.spyOn(exec, 'exec').mockResolvedValue(mockExecResult(JSON.stringify({ id: 'ws-1' })));

    const result = await manager.remove('ws-1');

    expect(exec.exec).toHaveBeenCalledWith('kdn', ['workspace', 'remove', 'ws-1', '--output', 'json']);
    expect(result).toEqual({ id: 'ws-1' });
  });

  test('emits agent-workspace-update event', async () => {
    vi.spyOn(exec, 'exec').mockResolvedValue(mockExecResult(JSON.stringify({ id: 'ws-1' })));

    await manager.remove('ws-1');

    expect(apiSender.send).toHaveBeenCalledWith('agent-workspace-update');
  });

  test('rejects when CLI fails for unknown id', async () => {
    vi.spyOn(exec, 'exec').mockRejectedValue(new Error('workspace not found: unknown-id'));

    await expect(manager.remove('unknown-id')).rejects.toThrow('workspace not found: unknown-id');
  });
});

describe('getConfiguration', () => {
  test('reads YAML configuration file for the workspace', async () => {
    vi.spyOn(exec, 'exec').mockResolvedValue(mockExecResult(JSON.stringify({ items: TEST_SUMMARIES })));
    vi.mocked(readFile).mockResolvedValue('mounts:\n  dependencies: []\n');
    vi.mocked(parseYAML).mockReturnValue({ mounts: { dependencies: [] } });

    const result = await manager.getConfiguration('ws-1');

    expect(exec.exec).toHaveBeenCalledWith('kdn', ['workspace', 'list', '--output', 'json']);
    expect(readFile).toHaveBeenCalledWith('/tmp/ws1/.kaiden.yaml', 'utf-8');
    expect(parseYAML).toHaveBeenCalledWith('mounts:\n  dependencies: []\n');
    expect(result).toEqual({ mounts: { dependencies: [] } });
  });

  test('throws when workspace id is not found in list', async () => {
    vi.spyOn(exec, 'exec').mockResolvedValue(mockExecResult(JSON.stringify({ items: TEST_SUMMARIES })));

    await expect(manager.getConfiguration('unknown-id')).rejects.toThrow(
      'workspace "unknown-id" not found. Use "workspace list" to see available workspaces.',
    );
  });

  test('returns empty configuration when file does not exist', async () => {
    vi.spyOn(exec, 'exec').mockResolvedValue(mockExecResult(JSON.stringify({ items: TEST_SUMMARIES })));
    const enoent = Object.assign(new Error('ENOENT: no such file'), { code: 'ENOENT' });
    vi.mocked(readFile).mockRejectedValue(enoent);

    const result = await manager.getConfiguration('ws-1');

    expect(result).toEqual({});
  });

  test('rejects when reading the configuration file fails with a non-ENOENT error', async () => {
    vi.spyOn(exec, 'exec').mockResolvedValue(mockExecResult(JSON.stringify({ items: TEST_SUMMARIES })));
    const eacces = Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' });
    vi.mocked(readFile).mockRejectedValue(eacces);

    await expect(manager.getConfiguration('ws-1')).rejects.toThrow('EACCES: permission denied');
  });
});

describe('start', () => {
  test('executes kdn workspace start and returns the workspace id', async () => {
    vi.spyOn(exec, 'exec').mockResolvedValue(mockExecResult(JSON.stringify({ id: 'ws-1' })));

    const result = await manager.start('ws-1');

    expect(exec.exec).toHaveBeenCalledWith('kdn', ['workspace', 'start', 'ws-1', '--output', 'json']);
    expect(result).toEqual({ id: 'ws-1' });
  });

  test('emits agent-workspace-update event', async () => {
    vi.spyOn(exec, 'exec').mockResolvedValue(mockExecResult(JSON.stringify({ id: 'ws-1' })));

    await manager.start('ws-1');

    expect(apiSender.send).toHaveBeenCalledWith('agent-workspace-update');
  });

  test('rejects when CLI fails for unknown id', async () => {
    vi.spyOn(exec, 'exec').mockRejectedValue(new Error('workspace not found: unknown-id'));

    await expect(manager.start('unknown-id')).rejects.toThrow('workspace not found: unknown-id');
  });
});

describe('stop', () => {
  test('executes kdn workspace stop and returns the workspace id', async () => {
    vi.spyOn(exec, 'exec').mockResolvedValue(mockExecResult(JSON.stringify({ id: 'ws-1' })));

    const result = await manager.stop('ws-1');

    expect(exec.exec).toHaveBeenCalledWith('kdn', ['workspace', 'stop', 'ws-1', '--output', 'json']);
    expect(result).toEqual({ id: 'ws-1' });
  });

  test('emits agent-workspace-update event', async () => {
    vi.spyOn(exec, 'exec').mockResolvedValue(mockExecResult(JSON.stringify({ id: 'ws-1' })));

    await manager.stop('ws-1');

    expect(apiSender.send).toHaveBeenCalledWith('agent-workspace-update');
  });

  test('rejects when CLI fails for unknown id', async () => {
    vi.spyOn(exec, 'exec').mockRejectedValue(new Error('workspace not found: unknown-id'));

    await expect(manager.stop('unknown-id')).rejects.toThrow('workspace not found: unknown-id');
  });
});
