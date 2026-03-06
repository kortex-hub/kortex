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

import type { ApiSenderType, IPCHandle } from '/@/plugin/api.js';
import type { AgentWorkspaceInfo } from '/@api/agent-workspace-info.js';

import { AgentWorkspaceManager } from './agent-workspace-manager.js';

const TEST_WORKSPACES: AgentWorkspaceInfo[] = [
  {
    id: 'ws-1',
    name: 'test-workspace-1',
    description: 'First test workspace',
    agent: 'claude',
    model: 'claude-sonnet-4-20250514',
    status: 'stopped',
    workingDirectory: '/tmp/ws1',
    contextUsage: { used: 0, total: 200_000 },
    resources: { skills: ['kubernetes'], mcpServers: ['github'] },
    fileAccess: 'workspace',
    stats: { messages: 0, toolCalls: 0, filesModified: 0, linesChanged: 0 },
    createdAt: '2026-03-01T00:00:00.000Z',
  },
  {
    id: 'ws-2',
    name: 'test-workspace-2',
    description: 'Second test workspace',
    agent: 'cursor',
    model: 'gpt-4o',
    status: 'running',
    workingDirectory: '/tmp/ws2',
    contextUsage: { used: 50_000, total: 128_000 },
    resources: { skills: [], mcpServers: ['filesystem'] },
    fileAccess: 'home',
    stats: { messages: 10, toolCalls: 5, filesModified: 3, linesChanged: 120 },
    startedAt: '2026-03-01T01:00:00.000Z',
    createdAt: '2026-03-01T00:00:00.000Z',
  },
];

let manager: AgentWorkspaceManager;

const apiSender: ApiSenderType = {
  send: vi.fn(),
  receive: vi.fn(),
};

const ipcHandle: IPCHandle = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  manager = new AgentWorkspaceManager(apiSender, ipcHandle);
  vi.spyOn(manager, 'loadWorkspaces').mockReturnValue(structuredClone(TEST_WORKSPACES));
  manager.init();
});

describe('init', () => {
  test('registers IPC handlers', () => {
    expect(ipcHandle).toHaveBeenCalledWith('agent-workspace:list', expect.any(Function));
    expect(ipcHandle).toHaveBeenCalledWith('agent-workspace:get', expect.any(Function));
    expect(ipcHandle).toHaveBeenCalledWith('agent-workspace:create', expect.any(Function));
    expect(ipcHandle).toHaveBeenCalledWith('agent-workspace:start', expect.any(Function));
    expect(ipcHandle).toHaveBeenCalledWith('agent-workspace:stop', expect.any(Function));
    expect(ipcHandle).toHaveBeenCalledWith('agent-workspace:delete', expect.any(Function));
  });

  test('loads workspaces from loadWorkspaces', () => {
    expect(manager.loadWorkspaces).toHaveBeenCalled();
    expect(manager.list()).toHaveLength(TEST_WORKSPACES.length);
  });
});

describe('list', () => {
  test('returns all loaded workspaces', () => {
    const workspaces = manager.list();
    expect(workspaces).toHaveLength(2);
    expect(workspaces.map(w => w.id)).toEqual(['ws-1', 'ws-2']);
  });
});

describe('get', () => {
  test('returns a workspace by id', () => {
    const result = manager.get('ws-1');
    expect(result.name).toBe('test-workspace-1');
    expect(result.agent).toBe('claude');
  });

  test('throws for unknown id', () => {
    expect(() => manager.get('nonexistent-id')).toThrow('Agent workspace not found: nonexistent-id');
  });
});

describe('create', () => {
  test('creates a workspace with provided options', () => {
    const ws = manager.create({
      name: 'new-workspace',
      description: 'Test description',
      agent: 'goose',
      model: 'custom-model',
      workingDirectory: '/tmp/test',
      skills: ['k8s'],
      mcpServers: ['github'],
      fileAccess: 'home',
    });

    expect(ws.id).toBeDefined();
    expect(ws.name).toBe('new-workspace');
    expect(ws.description).toBe('Test description');
    expect(ws.agent).toBe('goose');
    expect(ws.model).toBe('custom-model');
    expect(ws.status).toBe('stopped');
    expect(ws.workingDirectory).toBe('/tmp/test');
    expect(ws.resources.skills).toEqual(['k8s']);
    expect(ws.resources.mcpServers).toEqual(['github']);
    expect(ws.fileAccess).toBe('home');
    expect(ws.stats).toEqual({ messages: 0, toolCalls: 0, filesModified: 0, linesChanged: 0 });

    expect(manager.get(ws.id)).toBeDefined();
    expect(manager.list()).toHaveLength(3);
  });

  test('applies defaults for optional fields', () => {
    const ws = manager.create({ name: 'minimal', agent: 'claude' });

    expect(ws.description).toBe('');
    expect(ws.model).toBe('claude-sonnet-4-20250514');
    expect(ws.workingDirectory).toBe('.');
    expect(ws.resources.skills).toEqual([]);
    expect(ws.resources.mcpServers).toEqual([]);
    expect(ws.fileAccess).toBe('workspace');
  });

  test('assigns correct default model per agent', () => {
    const claude = manager.create({ name: 'c', agent: 'claude' });
    const cursor = manager.create({ name: 'cu', agent: 'cursor' });
    const goose = manager.create({ name: 'g', agent: 'goose' });

    expect(claude.model).toBe('claude-sonnet-4-20250514');
    expect(cursor.model).toBe('gpt-4o');
    expect(goose.model).toBe('granite-3.1');
  });

  test('derives context window size from model', () => {
    const claude = manager.create({ name: 'c', agent: 'claude' });
    const cursor = manager.create({ name: 'cu', agent: 'cursor' });

    expect(claude.contextUsage.total).toBe(200_000);
    expect(cursor.contextUsage.total).toBe(128_000);
  });

  test('falls back to 128k for unknown models', () => {
    const ws = manager.create({ name: 'custom', agent: 'claude', model: 'some-future-model' });
    expect(ws.contextUsage.total).toBe(128_000);
  });

  test('sends update event', () => {
    manager.create({ name: 'test', agent: 'claude' });
    expect(apiSender.send).toHaveBeenCalledWith('agent-workspace:updated');
  });
});

describe('start', () => {
  test('sets status to running', () => {
    const result = manager.start('ws-1');

    expect(result.status).toBe('running');
    expect(result.startedAt).toBeDefined();
  });

  test('sends update event', () => {
    manager.start('ws-1');
    expect(apiSender.send).toHaveBeenCalledWith('agent-workspace:updated');
  });

  test('is idempotent when already running', () => {
    manager.start('ws-2');
    const originalStartedAt = manager.get('ws-2').startedAt;
    vi.mocked(apiSender.send).mockClear();

    const result = manager.start('ws-2');

    expect(result.status).toBe('running');
    expect(result.startedAt).toBe(originalStartedAt);
    expect(apiSender.send).not.toHaveBeenCalled();
  });

  test('throws for unknown id', () => {
    expect(() => manager.start('bad-id')).toThrow('Agent workspace not found: bad-id');
  });
});

describe('stop', () => {
  test('sets status to stopped', () => {
    const result = manager.stop('ws-2');

    expect(result.status).toBe('stopped');
  });

  test('sends update event', () => {
    manager.stop('ws-2');
    expect(apiSender.send).toHaveBeenCalledWith('agent-workspace:updated');
  });

  test('is idempotent when already stopped', () => {
    vi.mocked(apiSender.send).mockClear();

    const result = manager.stop('ws-1');

    expect(result.status).toBe('stopped');
    expect(apiSender.send).not.toHaveBeenCalled();
  });

  test('throws for unknown id', () => {
    expect(() => manager.stop('bad-id')).toThrow('Agent workspace not found: bad-id');
  });
});

describe('delete', () => {
  test('removes the workspace', () => {
    manager.delete('ws-1');

    expect(manager.list()).toHaveLength(1);
    expect(() => manager.get('ws-1')).toThrow();
  });

  test('sends update event', () => {
    manager.delete('ws-1');
    expect(apiSender.send).toHaveBeenCalledWith('agent-workspace:updated');
  });

  test('throws for unknown id', () => {
    expect(() => manager.delete('bad-id')).toThrow('Agent workspace not found: bad-id');
  });
});

describe('dispose', () => {
  test('clears all workspaces', () => {
    manager.dispose();
    expect(manager.list()).toHaveLength(0);
  });
});
