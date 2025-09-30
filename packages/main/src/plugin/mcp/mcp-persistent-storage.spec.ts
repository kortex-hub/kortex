/**********************************************************************
 * Copyright (C) 2025 Red Hat, Inc.
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

import type { MCPConfigurations } from '@kortex-hub/mcp-manager';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { MCPPersistentStorage } from '/@/plugin/mcp/mcp-persistent-storage.js';
import type { SafeStorageRegistry, SecretStorageWrapper } from '/@/plugin/safe-storage/safe-storage-registry.js';

const MOCK_SECRET_STORAGE: SecretStorageWrapper = {
  store: vi.fn(),
  get: vi.fn(),
  delete: vi.fn(),
} as unknown as SecretStorageWrapper;

const MOCK_SAFE_STORAGE_REGISTRY: SafeStorageRegistry = {
  getCoreStorage: vi.fn(),
} as unknown as SafeStorageRegistry;

const MOCK_CONFIG: MCPConfigurations = {
  id: 'test-config-id',
  name: 'Test Config',
  type: 'remote',
  headers: {},
  remoteId: 0,
  serverId: 'uuid',
  version: '1.0.1',
  registryURL: 'foo.bar.com',
};

const MOCK_CONFIG_2: MCPConfigurations = {
  id: 'test-config-id-2',
  name: 'Test Config 2',
  type: 'remote',
  headers: {},
  remoteId: 0,
  serverId: 'uuid',
  version: '1.0.1',
  registryURL: 'foo.bar2.com',
};

let mcpPersistentStorage: MCPPersistentStorage;

beforeEach(() => {
  vi.resetAllMocks();

  vi.mocked(MOCK_SAFE_STORAGE_REGISTRY.getCoreStorage).mockReturnValue(MOCK_SECRET_STORAGE);

  mcpPersistentStorage = new MCPPersistentStorage(MOCK_SAFE_STORAGE_REGISTRY);
});

describe('MCPPersistentStorage#constructor', () => {
  test('should initialize with SafeStorageRegistry', () => {
    expect(MOCK_SAFE_STORAGE_REGISTRY.getCoreStorage).toHaveBeenCalledOnce();
  });
});

describe('MCPPersistentStorage#values', () => {
  test('should return empty array when no data stored', async () => {
    vi.mocked(MOCK_SECRET_STORAGE.get).mockResolvedValue(undefined);

    const result = await mcpPersistentStorage.values();

    expect(MOCK_SECRET_STORAGE.get).toHaveBeenCalledWith('mcp:configurations');
    expect(result).toEqual([]);
  });

  test('should return parsed configurations when data exists', async () => {
    const storedConfigs = [MOCK_CONFIG, MOCK_CONFIG_2];
    vi.mocked(MOCK_SECRET_STORAGE.get).mockResolvedValue(JSON.stringify(storedConfigs));

    const result = await mcpPersistentStorage.values();

    expect(MOCK_SECRET_STORAGE.get).toHaveBeenCalledWith('mcp:configurations');
    expect(result).toEqual(storedConfigs);
  });
});

describe('MCPPersistentStorage#add', () => {
  test('should add configuration to empty storage', async () => {
    vi.mocked(MOCK_SECRET_STORAGE.get).mockResolvedValue(undefined);

    await mcpPersistentStorage.add(MOCK_CONFIG);

    expect(MOCK_SECRET_STORAGE.get).toHaveBeenCalledWith('mcp:configurations');
    expect(MOCK_SECRET_STORAGE.store).toHaveBeenCalledWith('mcp:configurations', JSON.stringify([MOCK_CONFIG]));
  });

  test('should add configuration to existing storage', async () => {
    const existingConfigs = [MOCK_CONFIG];
    vi.mocked(MOCK_SECRET_STORAGE.get).mockResolvedValue(JSON.stringify(existingConfigs));

    await mcpPersistentStorage.add(MOCK_CONFIG_2);

    expect(MOCK_SECRET_STORAGE.get).toHaveBeenCalledWith('mcp:configurations');
    expect(MOCK_SECRET_STORAGE.store).toHaveBeenCalledWith(
      'mcp:configurations',
      JSON.stringify([MOCK_CONFIG, MOCK_CONFIG_2]),
    );
  });
});

describe('MCPPersistentStorage#delete', () => {
  test('should delete configuration by id', async () => {
    const existingConfigs = [MOCK_CONFIG, MOCK_CONFIG_2];
    vi.mocked(MOCK_SECRET_STORAGE.get).mockResolvedValue(JSON.stringify(existingConfigs));

    await mcpPersistentStorage.delete('test-config-id');

    expect(MOCK_SECRET_STORAGE.get).toHaveBeenCalledWith('mcp:configurations');
    expect(MOCK_SECRET_STORAGE.store).toHaveBeenCalledWith('mcp:configurations', JSON.stringify([MOCK_CONFIG_2]));
  });

  test('should handle deletion of non-existent configuration', async () => {
    const existingConfigs = [MOCK_CONFIG];
    vi.mocked(MOCK_SECRET_STORAGE.get).mockResolvedValue(JSON.stringify(existingConfigs));

    await mcpPersistentStorage.delete('non-existent-id');

    expect(MOCK_SECRET_STORAGE.get).toHaveBeenCalledWith('mcp:configurations');
    expect(MOCK_SECRET_STORAGE.store).toHaveBeenCalledWith('mcp:configurations', JSON.stringify([MOCK_CONFIG]));
  });

  test('should handle deletion from empty storage', async () => {
    vi.mocked(MOCK_SECRET_STORAGE.get).mockResolvedValue(undefined);

    await mcpPersistentStorage.delete('test-config-id');

    expect(MOCK_SECRET_STORAGE.get).toHaveBeenCalledWith('mcp:configurations');
    expect(MOCK_SECRET_STORAGE.store).toHaveBeenCalledWith('mcp:configurations', JSON.stringify([]));
  });
});

describe('MCPPersistentStorage#get', () => {
  test('should return configuration by id', async () => {
    const existingConfigs = [MOCK_CONFIG, MOCK_CONFIG_2];
    vi.mocked(MOCK_SECRET_STORAGE.get).mockResolvedValue(JSON.stringify(existingConfigs));

    const result = await mcpPersistentStorage.get('test-config-id');

    expect(MOCK_SECRET_STORAGE.get).toHaveBeenCalledWith('mcp:configurations');
    expect(result).toEqual(MOCK_CONFIG);
  });

  test('should throw error when configuration not found', async () => {
    const existingConfigs = [MOCK_CONFIG];
    vi.mocked(MOCK_SECRET_STORAGE.get).mockResolvedValue(JSON.stringify(existingConfigs));

    await expect(mcpPersistentStorage.get('non-existent-id')).rejects.toThrow(
      'Configuration non-existent-id not found',
    );
  });

  test('should throw error when storage is empty', async () => {
    vi.mocked(MOCK_SECRET_STORAGE.get).mockResolvedValue(undefined);

    await expect(mcpPersistentStorage.get('test-config-id')).rejects.toThrow('Configuration test-config-id not found');
  });
});
