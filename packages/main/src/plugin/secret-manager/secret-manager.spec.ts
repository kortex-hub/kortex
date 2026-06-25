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

import type { FileSystemWatcher } from '@openkaiden/api';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import type { IPCHandle } from '/@/plugin/api.js';
import type { CliToolRegistry } from '/@/plugin/cli-tool-registry.js';
import type { FilesystemMonitoring } from '/@/plugin/filesystem-monitoring.js';
import { OpenshellCli } from '/@/plugin/openshell-cli/openshell-cli.js';
import type { Exec } from '/@/plugin/util/exec.js';
import type { ApiSenderType } from '/@api/api-sender/api-sender-type.js';
import type { SecretCreateOptions } from '/@api/secret-info.js';

import { OpenshellSecretAdapter } from './openshell-secret-adapter.js';
import { SecretManager } from './secret-manager.js';

vi.mock(import('/@/plugin/openshell-cli/openshell-cli.js'));

let manager: SecretManager;

const apiSender: ApiSenderType = {
  send: vi.fn(),
  receive: vi.fn(),
};
const ipcHandle: IPCHandle = vi.fn();
const openshellCli = new OpenshellCli({} as Exec, {} as CliToolRegistry);
const openshellAdapter = new OpenshellSecretAdapter(openshellCli);

const mockWatcher = {
  onDidChange: vi.fn(),
  onDidCreate: vi.fn(),
  onDidDelete: vi.fn(),
  dispose: vi.fn(),
} as unknown as FileSystemWatcher;
const filesystemMonitoring = {
  createFileSystemWatcher: vi.fn().mockReturnValue(mockWatcher),
} as unknown as FilesystemMonitoring;

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(filesystemMonitoring.createFileSystemWatcher).mockReturnValue(mockWatcher);
  manager = new SecretManager(apiSender, ipcHandle, openshellAdapter);
  manager.init();
});

describe('init', () => {
  test('registers IPC handler for create', () => {
    expect(ipcHandle).toHaveBeenCalledWith('secret-manager:create', expect.any(Function));
  });

  test('registers IPC handler for list', () => {
    expect(ipcHandle).toHaveBeenCalledWith('secret-manager:list', expect.any(Function));
  });

  test('registers IPC handler for remove', () => {
    expect(ipcHandle).toHaveBeenCalledWith('secret-manager:remove', expect.any(Function));
  });
});

describe('openshellAdapter', () => {
  const defaultOptions: SecretCreateOptions = {
    name: 'my-secret',
    type: 'github',
    value: {
      credentials: {
        GH_TOKEN: 'ghp_abc123',
      },
    },
  };

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(filesystemMonitoring.createFileSystemWatcher).mockReturnValue(mockWatcher);
    manager = new SecretManager(apiSender, ipcHandle, openshellAdapter);
    manager.init();
  });

  test('delegates create to openshellAdapter', async () => {
    vi.mocked(openshellCli.createProvider).mockResolvedValue(undefined);

    const result = await manager.create(defaultOptions);

    expect(openshellCli.createProvider).toHaveBeenCalledWith({
      name: 'my-secret',
      type: 'github',
      credentials: { GH_TOKEN: 'ghp_abc123' },
    });
    expect(result).toEqual({ name: 'my-secret' });
  });

  test('delegates list to openshellAdapter', async () => {
    vi.mocked(openshellCli.listProviders).mockResolvedValue([
      { name: 'my-openai', type: 'openai' },
      { name: 'my-anthropic', type: 'anthropic' },
    ]);

    const result = await manager.list();

    expect(openshellCli.listProviders).toHaveBeenCalled();
    expect(result).toHaveLength(2);
    expect(result.map(s => s.name)).toEqual(['my-openai', 'my-anthropic']);
  });

  test('delegates remove to openshellAdapter', async () => {
    vi.mocked(openshellCli.deleteProvider).mockResolvedValue(undefined);

    const result = await manager.remove('my-openai');

    expect(openshellCli.deleteProvider).toHaveBeenCalledWith('my-openai');
    expect(result).toEqual({ name: 'my-openai' });
  });

  test('listServices returns empty array', async () => {
    const result = await manager.listServices();

    expect(result).toEqual([]);
  });

  test('skips file watching', () => {
    expect(filesystemMonitoring.createFileSystemWatcher).not.toHaveBeenCalled();
  });

  test('still emits secret-manager-update on create', async () => {
    vi.mocked(openshellCli.createProvider).mockResolvedValue(undefined);

    await manager.create(defaultOptions);

    expect(apiSender.send).toHaveBeenCalledWith('secret-manager-update');
  });

  test('still emits secret-manager-update on remove', async () => {
    vi.mocked(openshellCli.deleteProvider).mockResolvedValue(undefined);

    await manager.remove('my-openai');

    expect(apiSender.send).toHaveBeenCalledWith('secret-manager-update');
  });
});
