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

import type { ChunkProvider, ProviderRagConnection } from '@kortex-app/api';
import type { MockInstance } from 'vitest';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import type { IPCHandle } from '/@/plugin/api.js';
import type { ChunkProviderRegistry } from '/@/plugin/chunk-provider-registry.js';
import type { MCPManager } from '/@/plugin/mcp/mcp-manager.js';
import type { ProviderRegistry } from '/@/plugin/provider-registry.js';
import type { TaskManager } from '/@/plugin/tasks/task-manager.js';
import type { Task } from '/@/plugin/tasks/tasks.js';
import type { ApiSenderType } from '/@api/api-sender/api-sender-type.js';
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

const ipcHandle: IPCHandle = vi.fn();

const chunkProviderRegistry = {
  getChunkProvider: vi.fn(),
  findProviderById: vi.fn(),
} as unknown as ChunkProviderRegistry;

const providerRegistry = {
  onDidRegisterRagConnection: vi.fn(),
  onDidUnregisterRagConnection: vi.fn(),
  getRagConnections: vi.fn().mockReturnValue([]),
} as unknown as ProviderRegistry;

const taskManager = {
  getTask: vi.fn(),
  createTask: vi.fn(),
} as unknown as TaskManager;

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
    ipcHandle,
    directories,
    chunkProviderRegistry,
    providerRegistry,
    taskManager,
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

    await ragEnvironmentRegistry.deleteRagEnvironment('test-env');

    expect(unlink).toHaveBeenCalledWith(resolve(mockRagDirectory, 'test-env.json'));
  });

  test('should throw error when deleting a non-existent RAG environment', async () => {
    vi.mocked(existsSync).mockReturnValue(false);

    await expect(ragEnvironmentRegistry.deleteRagEnvironment('non-existent')).rejects.toThrowError();

    expect(unlink).not.toHaveBeenCalled();
  });

  test('should throw error and log error when deletion fails', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(unlink).mockImplementation(() => {
      throw new Error('Failed to delete file');
    });

    await expect(ragEnvironmentRegistry.deleteRagEnvironment('test-env')).rejects.toThrowError();

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

  describe('addFileToPendingFiles', () => {
    test('should successfully add a file to pending files and trigger indexing', async () => {
      const ragEnvironment: RagEnvironment = {
        name: 'test-env',
        ragConnection: {
          providerId: 'provider-1',
          name: 'rag-conn-1',
        },
        chunkerId: 'chunker-1',
        files: [],
      };

      await ragEnvironmentRegistry.saveOrUpdate(ragEnvironment);

      // Mock chunk provider
      const mockChunkProvider = {
        name: 'chunker',
        chunk: vi.fn().mockResolvedValue([{ text: 'chunk1' }, { text: 'chunk2' }]),
      };
      vi.mocked(chunkProviderRegistry.findProviderById).mockReturnValue(mockChunkProvider);

      // Mock RAG connection
      const mockRagConnection = {
        providerId: 'provider-1',
        connection: {
          name: 'rag-conn-1',
          index: vi.fn().mockResolvedValue(undefined),
          deindex: vi.fn(),
        },
      } as unknown as ProviderRagConnection;
      vi.mocked(providerRegistry.getRagConnections).mockReturnValue([mockRagConnection]);

      // Mock task manager
      const mockTask = {
        state: '',
        status: '',
        error: '',
      } as unknown as Task;
      vi.mocked(taskManager.createTask).mockReturnValue(mockTask);

      const result = await ragEnvironmentRegistry.addFileToPendingFiles('test-env', '/path/to/newfile.txt');

      expect(result).toBe(true);
      expect(chunkProviderRegistry.findProviderById).toHaveBeenCalledWith('chunker-1');
      expect(providerRegistry.getRagConnections).toHaveBeenCalled();

      // Verify chunking and indexing were called
      expect(mockChunkProvider.chunk).toHaveBeenCalled();
      expect(mockRagConnection.connection.index).toHaveBeenCalled();

      // Check that the file was added and indexed successfully
      const updatedEnv = ragEnvironmentRegistry.getEnvironment('test-env');
      expect(updatedEnv?.files).toHaveLength(1);
      expect(updatedEnv?.files[0]).toEqual({
        path: '/path/to/newfile.txt',
        status: 'indexed',
      });
    });

    test('should return false if environment does not exist', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await ragEnvironmentRegistry.addFileToPendingFiles('non-existent', '/path/to/file.txt');

      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('RAG environment non-existent not found'));

      consoleErrorSpy.mockRestore();
    });

    test('should return false if file is already in the environment', async () => {
      const ragEnvironment: RagEnvironment = {
        name: 'test-env',
        ragConnection: {
          providerId: 'provider-1',
          name: 'rag-conn-1',
        },
        chunkerId: 'chunker-1',
        files: [{ path: '/path/to/existing.txt', status: 'indexed' }],
      };

      await ragEnvironmentRegistry.saveOrUpdate(ragEnvironment);

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await ragEnvironmentRegistry.addFileToPendingFiles('test-env', '/path/to/existing.txt');

      expect(result).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('File /path/to/existing.txt is already in RAG environment test-env'),
      );

      consoleWarnSpy.mockRestore();
    });

    test('should return false if chunk provider is not found', async () => {
      const ragEnvironment: RagEnvironment = {
        name: 'test-env',
        ragConnection: {
          providerId: 'provider-1',
          name: 'rag-conn-1',
        },
        chunkerId: 'chunker-1',
        files: [],
      };

      await ragEnvironmentRegistry.saveOrUpdate(ragEnvironment);

      vi.mocked(chunkProviderRegistry.findProviderById).mockReturnValue(undefined);

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await ragEnvironmentRegistry.addFileToPendingFiles('test-env', '/path/to/newfile.txt');

      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Chunk provider with ID chunker-1 not found'),
      );

      consoleErrorSpy.mockRestore();
    });

    test('should return false if RAG connection is not found', async () => {
      const ragEnvironment: RagEnvironment = {
        name: 'test-env',
        ragConnection: {
          providerId: 'provider-1',
          name: 'rag-conn-1',
        },
        chunkerId: 'chunker-1',
        files: [],
      };

      await ragEnvironmentRegistry.saveOrUpdate(ragEnvironment);

      const mockChunkProvider = {
        chunk: vi.fn(),
      } as unknown as ChunkProvider;
      vi.mocked(chunkProviderRegistry.findProviderById).mockReturnValue(mockChunkProvider);
      vi.mocked(providerRegistry.getRagConnections).mockReturnValue([]);

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await ragEnvironmentRegistry.addFileToPendingFiles('test-env', '/path/to/newfile.txt');

      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Rag connection rag-conn-1 not found'));

      consoleErrorSpy.mockRestore();
    });

    test('should handle chunking failure gracefully', async () => {
      const ragEnvironment: RagEnvironment = {
        name: 'test-env',
        ragConnection: {
          providerId: 'provider-1',
          name: 'rag-conn-1',
        },
        chunkerId: 'chunker-1',
        files: [],
      };

      await ragEnvironmentRegistry.saveOrUpdate(ragEnvironment);

      // Mock chunk provider that fails
      const mockChunkProvider = {
        chunk: vi.fn().mockRejectedValue(new Error('Chunking failed')),
      } as unknown as ChunkProvider;
      vi.mocked(chunkProviderRegistry.findProviderById).mockReturnValue(mockChunkProvider);

      const mockRagConnection = {
        providerId: 'provider-1',
        connection: {
          name: 'rag-conn-1',
          index: vi.fn(),
          deindex: vi.fn(),
        },
      } as unknown as ProviderRagConnection;
      vi.mocked(providerRegistry.getRagConnections).mockReturnValue([mockRagConnection]);

      const mockTask = {
        state: '',
        status: '',
        error: '',
      } as unknown as Task;
      vi.mocked(taskManager.createTask).mockReturnValue(mockTask);

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await ragEnvironmentRegistry.addFileToPendingFiles('test-env', '/path/to/newfile.txt');

      expect(result).toBe(true); // File is added to pending, but indexing fails async

      expect(mockChunkProvider.chunk).toHaveBeenCalled();
      expect(mockRagConnection.connection.index).not.toHaveBeenCalled();
      expect(mockTask.status).toBe('failure');
      expect(mockTask.error).toContain('Chunking failed');

      consoleErrorSpy.mockRestore();
    });

    test('should handle indexing failure gracefully', async () => {
      const ragEnvironment: RagEnvironment = {
        name: 'test-env',
        ragConnection: {
          providerId: 'provider-1',
          name: 'rag-conn-1',
        },
        chunkerId: 'chunker-1',
        files: [],
      };

      await ragEnvironmentRegistry.saveOrUpdate(ragEnvironment);

      // Mock chunk provider
      const mockChunkProvider = {
        chunk: vi.fn().mockResolvedValue([{ text: 'chunk1' }, { text: 'chunk2' }]),
      } as unknown as ChunkProvider;
      vi.mocked(chunkProviderRegistry.findProviderById).mockReturnValue(mockChunkProvider);

      // Mock RAG connection that fails
      const mockRagConnection = {
        providerId: 'provider-1',
        connection: {
          name: 'rag-conn-1',
          index: vi.fn().mockRejectedValue(new Error('Indexing failed')),
          deindex: vi.fn(),
        },
      } as unknown as ProviderRagConnection;
      vi.mocked(providerRegistry.getRagConnections).mockReturnValue([mockRagConnection]);

      const chunkTask = { state: '', status: '', error: '' } as unknown as Task;
      const indexTask = { state: '', status: '', error: '' } as unknown as Task;
      vi.mocked(taskManager.createTask).mockReturnValueOnce(chunkTask).mockReturnValueOnce(indexTask);

      const result = await ragEnvironmentRegistry.addFileToPendingFiles('test-env', '/path/to/newfile.txt');

      expect(result).toBe(true);

      expect(mockChunkProvider.chunk).toHaveBeenCalled();
      expect(mockRagConnection.connection.index).toHaveBeenCalled();
      expect(chunkTask.status).toBe('success');
      expect(indexTask.status).toBe('failure');
      expect(indexTask.error).toContain('Indexing failed');
    });
  });

  describe('removeFileFromEnvironment', () => {
    test('should successfully remove a file from the environment', async () => {
      const ragEnvironment: RagEnvironment = {
        name: 'test-env',
        ragConnection: {
          providerId: 'provider-1',
          name: 'rag-conn-1',
        },
        chunkerId: 'chunker-1',
        files: [
          { path: '/path/to/file1.txt', status: 'indexed' },
          { path: '/path/to/file2.txt', status: 'indexed' },
        ],
      };

      await ragEnvironmentRegistry.saveOrUpdate(ragEnvironment);

      // Mock RAG connection
      const mockRagConnection = {
        providerId: 'provider-1',
        connection: {
          name: 'rag-conn-1',
          index: vi.fn(),
          deindex: vi.fn().mockResolvedValue(undefined),
        },
      } as unknown as ProviderRagConnection;
      vi.mocked(providerRegistry.getRagConnections).mockReturnValue([mockRagConnection]);

      // Mock task manager
      const mockTask = {
        state: '',
        status: '',
        error: '',
      } as unknown as Task;
      vi.mocked(taskManager.createTask).mockReturnValue(mockTask);

      const result = await ragEnvironmentRegistry.removeFileFromEnvironment('test-env', '/path/to/file1.txt');

      expect(result).toBe(true);
      expect(taskManager.createTask).toHaveBeenCalledWith({
        title: 'Removing /path/to/file1.txt from test-env',
      });
      expect(mockRagConnection.connection.deindex).toHaveBeenCalled();
      expect(mockTask.status).toBe('success');
      expect(mockTask.state).toBe('completed');

      // Check that the file was removed
      const updatedEnv = ragEnvironmentRegistry.getEnvironment('test-env');
      expect(updatedEnv?.files).toHaveLength(1);
      expect(updatedEnv?.files[0]?.path).toBe('/path/to/file2.txt');
    });

    test('should return false if environment does not exist', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await ragEnvironmentRegistry.removeFileFromEnvironment('non-existent', '/path/to/file.txt');

      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('RAG environment non-existent not found'));

      consoleErrorSpy.mockRestore();
    });

    test('should return false if file is not in the environment', async () => {
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

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await ragEnvironmentRegistry.removeFileFromEnvironment('test-env', '/path/to/nonexistent.txt');

      expect(result).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('File /path/to/nonexistent.txt is not in RAG environment test-env'),
      );

      consoleWarnSpy.mockRestore();
    });

    test('should return false if RAG connection is not found', async () => {
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

      vi.mocked(providerRegistry.getRagConnections).mockReturnValue([]);

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await ragEnvironmentRegistry.removeFileFromEnvironment('test-env', '/path/to/file1.txt');

      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Rag connection rag-conn-1 not found'));

      consoleErrorSpy.mockRestore();
    });

    test('should handle deindexing failure and mark task as failed', async () => {
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

      // Mock RAG connection that fails
      const mockRagConnection = {
        providerId: 'provider-1',
        connection: {
          name: 'rag-conn-1',
          index: vi.fn(),
          deindex: vi.fn().mockRejectedValue(new Error('Deindexing failed')),
        },
      } as unknown as ProviderRagConnection;
      vi.mocked(providerRegistry.getRagConnections).mockReturnValue([mockRagConnection]);

      const mockTask = {
        state: '',
        status: '',
        error: '',
      } as unknown as Task;
      vi.mocked(taskManager.createTask).mockReturnValue(mockTask);

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await ragEnvironmentRegistry.removeFileFromEnvironment('test-env', '/path/to/file1.txt');

      expect(result).toBe(false);
      expect(mockRagConnection.connection.deindex).toHaveBeenCalled();
      expect(mockTask.status).toBe('failure');
      expect(mockTask.error).toContain('Deindexing failed');
      expect(mockTask.state).toBe('completed');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to remove file from RAG environment test-env'),
        expect.anything(),
      );

      // File should not be removed if deindexing failed
      const updatedEnv = ragEnvironmentRegistry.getEnvironment('test-env');
      expect(updatedEnv?.files).toHaveLength(1);

      consoleErrorSpy.mockRestore();
    });

    test('should remove file even if it has pending status', async () => {
      const ragEnvironment: RagEnvironment = {
        name: 'test-env',
        ragConnection: {
          providerId: 'provider-1',
          name: 'rag-conn-1',
        },
        chunkerId: 'chunker-1',
        files: [
          { path: '/path/to/file1.txt', status: 'pending' },
          { path: '/path/to/file2.txt', status: 'indexed' },
        ],
      };

      await ragEnvironmentRegistry.saveOrUpdate(ragEnvironment);

      const mockRagConnection = {
        providerId: 'provider-1',
        connection: {
          name: 'rag-conn-1',
          index: vi.fn(),
          deindex: vi.fn().mockResolvedValue(undefined),
        },
      } as unknown as ProviderRagConnection;
      vi.mocked(providerRegistry.getRagConnections).mockReturnValue([mockRagConnection]);

      const mockTask = {
        state: '',
        status: '',
        error: '',
      } as unknown as Task;
      vi.mocked(taskManager.createTask).mockReturnValue(mockTask);

      const result = await ragEnvironmentRegistry.removeFileFromEnvironment('test-env', '/path/to/file1.txt');

      expect(result).toBe(true);
      expect(mockRagConnection.connection.deindex).toHaveBeenCalled();

      const updatedEnv = ragEnvironmentRegistry.getEnvironment('test-env');
      expect(updatedEnv?.files).toHaveLength(1);
      expect(updatedEnv?.files[0]?.path).toBe('/path/to/file2.txt');
    });
  });
});
