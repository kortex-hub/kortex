/**********************************************************************
 * Copyright (C) 2024-2025 Red Hat, Inc.
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

import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import type { MockInstance } from 'vitest';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import type { ApiSenderType } from '/@/plugin/api.js';
import type { ChunkProviderRegistry } from '/@/plugin/chunk-provider-registry.js';
import type { MCPManager } from '/@/plugin/mcp/mcp-manager.js';
import type { MCPRegistry } from '/@/plugin/mcp/mcp-registry.js';
import type { ProviderRegistry } from '/@/plugin/provider-registry.js';
import type { TaskManager } from '/@/plugin/tasks/task-manager.js';
import type { RagEnvironment } from '/@api/rag/rag-environment.js';

import type { Directories } from './directories.js';
import { RagEnvironmentRegistry } from './rag-environment-registry.js';

let ragEnvironmentRegistry: RagEnvironmentRegistry;
let mockRagDirectory: string;

const getConfigurationDirectoryMock = vi.fn();
const directories = {
  getConfigurationDirectory: getConfigurationDirectoryMock,
} as unknown as Directories;

const apiSender: ApiSenderType = {
  send: vi.fn(),
  receive: vi.fn(),
};

const chunkProviderRegistry = {
  getChunkProvider: vi.fn(),
} as unknown as ChunkProviderRegistry;

const providerRegistry = {
  onDidRegisterRagConnection: vi.fn(),
  onDidUnregisterRagConnection: vi.fn(),
  getRagConnections: vi.fn().mockReturnValue([]),
} as unknown as ProviderRegistry;

const taskManager = {
  getTask: vi.fn(),
} as unknown as TaskManager;

const mcpRegistry = {} as unknown as MCPRegistry;

const mcpManager = {} as unknown as MCPManager;

vi.mock('node:fs');
vi.mock('node:fs/promises');
// Mock fs methods

beforeEach(() => {
  vi.clearAllMocks();

  mockRagDirectory = '/mock-kortex-dir/rag';
  getConfigurationDirectoryMock.mockReturnValue('/mock-kortex-dir/configuration');

  // By default, assume directories don't exist initially
  vi.mocked(existsSync).mockReturnValue(false);
  vi.mocked(mkdir).mockResolvedValue(undefined);
  vi.mocked(writeFile).mockResolvedValue(undefined);
  vi.mocked(unlink).mockResolvedValue(undefined);

  ragEnvironmentRegistry = new RagEnvironmentRegistry(
    apiSender,
    directories,
    chunkProviderRegistry,
    providerRegistry,
    taskManager,
    mcpRegistry,
    mcpManager,
  );
});

describe('RagEnvironmentRegistry', () => {
  test('should save a RAG environment to a JSON file', async () => {
    const ragEnvironment: RagEnvironment = {
      name: 'test-env',
      ragConnection: {
        providerId: 'provider-1',
        name: 'rag-conn-1',
      },
      chunkerId: 'chunker-1',
      files: [
        {
          path: '/path/to/file1.txt',
          status: 'indexed',
        },
        { path: '/path/to/file2.txt', status: 'indexed' },
        {
          path: '/path/to/file3.txt',
          status: 'pending',
        },
      ],
    };

    await ragEnvironmentRegistry.saveOrUpdate(ragEnvironment);

    const expectedFilePath = resolve(mockRagDirectory, 'test-env.json');
    expect(writeFile).toHaveBeenCalledWith(expectedFilePath, JSON.stringify(ragEnvironment, undefined, 2));
  });

  test('should retrieve a RAG environment by name', async () => {
    const ragEnvironment: RagEnvironment = {
      name: 'test-env',
      ragConnection: {
        providerId: 'provider-1',
        name: 'rag-conn-1',
      },
      chunkerId: 'chunker-1',
      files: [{ path: '/path/to/file1.txt', status: 'indexed' }],
    };

    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFile).mockResolvedValue(JSON.stringify(ragEnvironment));

    const result = await ragEnvironmentRegistry.loadEnvironment('test-env');

    expect(result).toEqual(ragEnvironment);
    expect(readFile).toHaveBeenCalledWith(resolve(mockRagDirectory, 'test-env.json'), 'utf-8');
  });

  test('should return undefined when getting a non-existent RAG environment', async () => {
    vi.mocked(existsSync).mockReturnValue(false);

    const result = await ragEnvironmentRegistry.loadEnvironment('non-existent');

    expect(result).toBeUndefined();
  });

  test('should return undefined and log error when RAG environment file is corrupted', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFile).mockResolvedValue('invalid json content');

    const result = await ragEnvironmentRegistry.loadEnvironment('corrupted-env');

    expect(result).toBeUndefined();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to read RAG environment corrupted-env'),
      expect.anything(),
    );

    consoleErrorSpy.mockRestore();
  });

  test('should get all RAG environments', async () => {
    const ragEnv1: RagEnvironment = {
      name: 'env1',
      ragConnection: {
        providerId: 'provider-1',
        name: 'rag-conn-1',
      },
      chunkerId: 'chunker-1',
      files: [],
    };

    const ragEnv2: RagEnvironment = {
      name: 'env2',
      ragConnection: {
        providerId: 'provider-2',
        name: 'rag-conn-2',
      },
      chunkerId: 'chunker-2',
      files: [],
    };

    vi.mocked(readdir as unknown as MockInstance<() => Promise<string[]>>).mockResolvedValue([
      'env1.json',
      'env2.json',
      'other-file.txt',
    ]);
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readFile as unknown as MockInstance<(path: string) => Promise<string>>).mockImplementation(
      async (filePath: string) => {
        if (filePath.toString().includes('env1.json')) {
          return JSON.stringify(ragEnv1);
        }
        if (filePath.toString().includes('env2.json')) {
          return JSON.stringify(ragEnv2);
        }
        return '';
      },
    );

    await ragEnvironmentRegistry.init();
    const result = await ragEnvironmentRegistry.getAllRagEnvironments();

    expect(result).toHaveLength(2);
    expect(result).toContainEqual(ragEnv1);
    expect(result).toContainEqual(ragEnv2);
  });

  test('should return empty array when getting all RAG environments and directory read fails', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(readdir).mockImplementation(() => {
      throw new Error('Failed to read directory');
    });

    await ragEnvironmentRegistry.init();
    const result = await ragEnvironmentRegistry.getAllRagEnvironments();

    expect(result).toEqual([]);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to read RAG environments'),
      expect.anything(),
    );

    consoleErrorSpy.mockRestore();
  });

  test('should delete a RAG environment', async () => {
    vi.mocked(existsSync).mockReturnValue(true);

    const result = await ragEnvironmentRegistry.deleteRagEnvironment('test-env');

    expect(result).toBe(true);
    expect(unlink).toHaveBeenCalledWith(resolve(mockRagDirectory, 'test-env.json'));
  });

  test('should return false when deleting a non-existent RAG environment', async () => {
    vi.mocked(existsSync).mockReturnValue(false);

    const result = await ragEnvironmentRegistry.deleteRagEnvironment('non-existent');

    expect(result).toBe(false);
    expect(unlink).not.toHaveBeenCalled();
  });

  test('should return false and log error when deletion fails', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(unlink).mockImplementation(() => {
      throw new Error('Failed to delete file');
    });

    const result = await ragEnvironmentRegistry.deleteRagEnvironment('test-env');

    expect(result).toBe(false);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to delete RAG environment test-env'),
      expect.anything(),
    );

    consoleErrorSpy.mockRestore();
  });

  test('should check if a RAG environment exists', () => {
    vi.mocked(existsSync).mockReturnValue(true);

    const result = ragEnvironmentRegistry.hasRagEnvironment('test-env');

    expect(result).toBe(true);
    expect(existsSync).toHaveBeenCalledWith(resolve(mockRagDirectory, 'test-env.json'));
  });

  test('should return false when checking for a non-existent RAG environment', () => {
    vi.mocked(existsSync).mockReturnValue(false);

    const result = ragEnvironmentRegistry.hasRagEnvironment('non-existent');

    expect(result).toBe(false);
  });

  test('should update an existing RAG environment', async () => {
    const ragEnvironment: RagEnvironment = {
      name: 'test-env',
      ragConnection: {
        providerId: 'provider-1',
        name: 'rag-conn-1',
      },
      chunkerId: 'chunker-1',
      files: [{ path: '/path/to/file1.txt', status: 'indexed' }],
    };

    await ragEnvironmentRegistry.saveOrUpdate(ragEnvironment);

    // Update the environment
    const updatedEnvironment: RagEnvironment = {
      ...ragEnvironment,
      files: [
        { path: '/path/to/file1.txt', status: 'indexed' },
        { path: '/path/to/file2.txt', status: 'indexed' },
      ],
    };

    await ragEnvironmentRegistry.saveOrUpdate(updatedEnvironment);

    const expectedFilePath = resolve(mockRagDirectory, 'test-env.json');
    expect(writeFile).toHaveBeenCalledTimes(2);
    expect(writeFile).toHaveBeenLastCalledWith(expectedFilePath, JSON.stringify(updatedEnvironment, undefined, 2));
  });
});
