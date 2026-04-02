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

import type { RunResult } from '@kortex-app/api';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { parse as parseYAML } from 'yaml';

import type { IPCHandle } from '/@/plugin/api.js';
import type { CliToolRegistry } from '/@/plugin/cli-tool-registry.js';
import type { Proxy } from '/@/plugin/proxy.js';
import { Exec } from '/@/plugin/util/exec.js';
import type { AgentWorkspaceCreateOptions, AgentWorkspaceSummary } from '/@api/agent-workspace-info.js';
import type { ApiSenderType } from '/@api/api-sender/api-sender-type.js';
import type { CliToolInfo } from '/@api/cli-tool-info.js';

import { AgentWorkspaceManager } from './agent-workspace-manager.js';

vi.mock(import('node:fs/promises'));
vi.mock(import('yaml'));

const TEST_SUMMARIES: AgentWorkspaceSummary[] = [
  {
    id: 'ws-1',
    name: 'test-workspace-1',
    project: 'project-alpha',
    paths: { source: '/tmp/ws1', configuration: '/tmp/ws1/.kortex.yaml' },
  },
  {
    id: 'ws-2',
    name: 'test-workspace-2',
    project: 'project-beta',
    paths: { source: '/tmp/ws2', configuration: '/tmp/ws2/.kortex.yaml' },
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
const cliToolRegistry = {
  getCliToolInfos: vi
    .fn()
    .mockReturnValue([
      { name: 'kortex', path: '/home/user/.config/kortex-extensions/kortex-cli/kortex-cli-package/kortex-cli' },
    ]),
} as unknown as CliToolRegistry;

const KORTEX_CLI_PATH = '/home/user/.config/kortex-extensions/kortex-cli/kortex-cli-package/kortex-cli';

function mockExecResult(stdout: string): RunResult {
  return { command: KORTEX_CLI_PATH, stdout, stderr: '' };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(cliToolRegistry.getCliToolInfos).mockReturnValue([
    { name: 'kortex', path: KORTEX_CLI_PATH },
  ] as unknown as CliToolInfo[]);
  manager = new AgentWorkspaceManager(apiSender, ipcHandle, exec, cliToolRegistry);
  manager.init();
});

describe('init', () => {
  test('registers IPC handler for create', () => {
    expect(ipcHandle).toHaveBeenCalledWith('agent-workspace:create', expect.any(Function));
  });

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

describe('getCliPath', () => {
  test('falls back to kortex-cli when no CLI tool is registered', async () => {
    vi.mocked(cliToolRegistry.getCliToolInfos).mockReturnValue([]);
    vi.spyOn(exec, 'exec').mockResolvedValue(mockExecResult(JSON.stringify({ items: [] })));

    await manager.list();

    expect(exec.exec).toHaveBeenCalledWith('kortex-cli', ['workspace', 'list', '--output', 'json'], undefined);
  });
});

describe('create', () => {
  const defaultOptions: AgentWorkspaceCreateOptions = {
    sourcePath: '/tmp/my-project',
    agent: 'claude',
    runtime: 'podman',
  };

  test('executes kortex-cli init with required flags and returns the workspace id', async () => {
    vi.spyOn(exec, 'exec').mockResolvedValue(mockExecResult(JSON.stringify({ id: 'ws-new' })));

    const result = await manager.create(defaultOptions);

    expect(exec.exec).toHaveBeenCalledWith(KORTEX_CLI_PATH, [
      'init',
      '/tmp/my-project',
      '--runtime',
      'podman',
      '--agent',
      'claude',
      '--output',
      'json',
    ]);
    expect(result).toEqual({ id: 'ws-new' });
  });

  test('defaults runtime to podman when not specified', async () => {
    vi.spyOn(exec, 'exec').mockResolvedValue(mockExecResult(JSON.stringify({ id: 'ws-new' })));

    await manager.create({ sourcePath: '/tmp/my-project', agent: 'claude' });

    expect(exec.exec).toHaveBeenCalledWith(KORTEX_CLI_PATH, expect.arrayContaining(['--runtime', 'podman']));
  });

  test('includes optional name flag when provided', async () => {
    vi.spyOn(exec, 'exec').mockResolvedValue(mockExecResult(JSON.stringify({ id: 'ws-new' })));

    await manager.create({ ...defaultOptions, name: 'my-workspace' });

    expect(exec.exec).toHaveBeenCalledWith(KORTEX_CLI_PATH, expect.arrayContaining(['--name', 'my-workspace']));
  });

  test('includes optional project flag when provided', async () => {
    vi.spyOn(exec, 'exec').mockResolvedValue(mockExecResult(JSON.stringify({ id: 'ws-new' })));

    await manager.create({ ...defaultOptions, project: 'my-project' });

    expect(exec.exec).toHaveBeenCalledWith(KORTEX_CLI_PATH, expect.arrayContaining(['--project', 'my-project']));
  });

  test('emits agent-workspace-update event', async () => {
    vi.spyOn(exec, 'exec').mockResolvedValue(mockExecResult(JSON.stringify({ id: 'ws-new' })));

    await manager.create(defaultOptions);

    expect(apiSender.send).toHaveBeenCalledWith('agent-workspace-update');
  });

  test('rejects when source directory does not exist', async () => {
    vi.spyOn(exec, 'exec').mockRejectedValue(new Error('sources directory does not exist: /tmp/not-found'));

    await expect(manager.create({ ...defaultOptions, sourcePath: '/tmp/not-found' })).rejects.toThrow(
      'sources directory does not exist: /tmp/not-found',
    );
  });
});

describe('list', () => {
  test('executes kortex-cli workspace list and returns items', async () => {
    vi.spyOn(exec, 'exec').mockResolvedValue(mockExecResult(JSON.stringify({ items: TEST_SUMMARIES })));

    const result = await manager.list();

    expect(exec.exec).toHaveBeenCalledWith(KORTEX_CLI_PATH, ['workspace', 'list', '--output', 'json'], undefined);
    expect(result).toHaveLength(2);
    expect(result.map(s => s.id)).toEqual(['ws-1', 'ws-2']);
  });

  test('returns summaries with expected CLI fields', async () => {
    vi.spyOn(exec, 'exec').mockResolvedValue(mockExecResult(JSON.stringify({ items: TEST_SUMMARIES })));

    const summary = (await manager.list())[0]!;

    expect(summary).toHaveProperty('id');
    expect(summary).toHaveProperty('name');
    expect(summary).toHaveProperty('project');
    expect(summary).toHaveProperty('paths');
    expect(summary.paths).toHaveProperty('source');
    expect(summary.paths).toHaveProperty('configuration');
  });

  test('rejects when CLI fails', async () => {
    vi.spyOn(exec, 'exec').mockRejectedValue(new Error('command not found'));

    await expect(manager.list()).rejects.toThrow('command not found');
  });
});

describe('remove', () => {
  test('executes kortex-cli workspace remove and returns the workspace id', async () => {
    vi.spyOn(exec, 'exec').mockResolvedValue(mockExecResult(JSON.stringify({ id: 'ws-1' })));

    const result = await manager.remove('ws-1');

    expect(exec.exec).toHaveBeenCalledWith(
      KORTEX_CLI_PATH,
      ['workspace', 'remove', 'ws-1', '--output', 'json'],
      undefined,
    );
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
    vi.mocked(readFile).mockResolvedValue('name: test-workspace-1\n');
    vi.mocked(parseYAML).mockReturnValue({ name: 'test-workspace-1' });

    const result = await manager.getConfiguration('ws-1');

    expect(exec.exec).toHaveBeenCalledWith(KORTEX_CLI_PATH, ['workspace', 'list', '--output', 'json'], undefined);
    expect(readFile).toHaveBeenCalledWith('/tmp/ws1/.kortex.yaml', 'utf-8');
    expect(parseYAML).toHaveBeenCalledWith('name: test-workspace-1\n');
    expect(result).toEqual({ name: 'test-workspace-1' });
  });

  test('throws when workspace id is not found in list', async () => {
    vi.spyOn(exec, 'exec').mockResolvedValue(mockExecResult(JSON.stringify({ items: TEST_SUMMARIES })));

    await expect(manager.getConfiguration('unknown-id')).rejects.toThrow(
      'workspace "unknown-id" not found. Use "workspace list" to see available workspaces.',
    );
  });

  test('rejects when reading the configuration file fails', async () => {
    vi.spyOn(exec, 'exec').mockResolvedValue(mockExecResult(JSON.stringify({ items: TEST_SUMMARIES })));
    vi.mocked(readFile).mockRejectedValue(new Error('ENOENT: no such file'));

    await expect(manager.getConfiguration('ws-1')).rejects.toThrow('ENOENT: no such file');
  });
});

describe('start', () => {
  test('executes kortex-cli workspace start and returns the workspace id', async () => {
    vi.spyOn(exec, 'exec').mockResolvedValue(mockExecResult(JSON.stringify({ id: 'ws-1' })));

    const result = await manager.start('ws-1');

    expect(exec.exec).toHaveBeenCalledWith(
      KORTEX_CLI_PATH,
      ['workspace', 'start', 'ws-1', '--output', 'json'],
      undefined,
    );
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
  test('executes kortex-cli workspace stop and returns the workspace id', async () => {
    vi.spyOn(exec, 'exec').mockResolvedValue(mockExecResult(JSON.stringify({ id: 'ws-1' })));

    const result = await manager.stop('ws-1');

    expect(exec.exec).toHaveBeenCalledWith(
      KORTEX_CLI_PATH,
      ['workspace', 'stop', 'ws-1', '--output', 'json'],
      undefined,
    );
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
