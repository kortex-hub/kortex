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

import type { FileSystemWatcher, InferenceProviderConnection, RegisterInferenceConnectionEvent } from '@openkaiden/api';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import type { IPCHandle } from '/@/plugin/api.js';
import type { CliToolRegistry } from '/@/plugin/cli-tool-registry.js';
import type { FilesystemMonitoring } from '/@/plugin/filesystem-monitoring.js';
import { OpenshellCli } from '/@/plugin/openshell-cli/openshell-cli.js';
import type { OpenshellGateway } from '/@/plugin/openshell-cli/openshell-gateway.js';
import type { ProviderImpl } from '/@/plugin/provider-impl.js';
import type { ProviderRegistry } from '/@/plugin/provider-registry.js';
import type { SafeStorageRegistry } from '/@/plugin/safe-storage/safe-storage-registry.js';
import type { Exec } from '/@/plugin/util/exec.js';
import type { ApiSenderType } from '/@api/api-sender/api-sender-type.js';
import type { IConfigurationRegistry } from '/@api/configuration/models.js';
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

let gatewayStartCallback: (() => void) | undefined;
let registerInferenceCallback: ((event: RegisterInferenceConnectionEvent) => void) | undefined;
let unregisterInferenceCallback:
  | ((event: { providerId: string; connection: InferenceProviderConnection }) => void)
  | undefined;

const providerRegistry = {
  onDidRegisterInferenceConnection: vi.fn((cb: (event: RegisterInferenceConnectionEvent) => void) => {
    registerInferenceCallback = cb;
  }),
  onDidUnregisterInferenceConnection: vi.fn(
    (cb: (event: { providerId: string; connection: InferenceProviderConnection }) => void) => {
      unregisterInferenceCallback = cb;
    },
  ),
  getInferenceConnection: vi.fn(),
  getProvider: vi.fn(),
} as unknown as ProviderRegistry;

const extensionStorageMock = {
  get: vi.fn(),
} as unknown as ReturnType<SafeStorageRegistry['getExtensionStorage']>;

const configurationRegistry = {
  getConfiguration: vi.fn(),
  getConfigurationProperties: vi.fn(),
} as unknown as IConfigurationRegistry;

const safeStorageRegistry = {
  getExtensionStorage: vi.fn().mockReturnValue(extensionStorageMock),
} as unknown as SafeStorageRegistry;

const openshellGateway = {
  onDidGatewayStart: vi.fn((cb: () => void) => {
    gatewayStartCallback = cb;
    return { dispose: vi.fn() };
  }),
} as unknown as OpenshellGateway;

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
  gatewayStartCallback = undefined;
  registerInferenceCallback = undefined;
  unregisterInferenceCallback = undefined;
  vi.mocked(filesystemMonitoring.createFileSystemWatcher).mockReturnValue(mockWatcher);
  vi.mocked(safeStorageRegistry.getExtensionStorage).mockReturnValue(extensionStorageMock);
  manager = new SecretManager(
    apiSender,
    ipcHandle,
    openshellAdapter,
    providerRegistry,
    configurationRegistry,
    safeStorageRegistry,
    openshellGateway,
  );
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

  test('subscribes to inference connection events', () => {
    expect(providerRegistry.onDidRegisterInferenceConnection).toHaveBeenCalled();
    expect(providerRegistry.onDidUnregisterInferenceConnection).toHaveBeenCalled();
  });

  test('subscribes to gateway start event', () => {
    expect(openshellGateway.onDidGatewayStart).toHaveBeenCalled();
  });

  test('sends secret-manager-update when gateway starts', () => {
    gatewayStartCallback!();
    expect(apiSender.send).toHaveBeenCalledWith('secret-manager-update');
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
    gatewayStartCallback = undefined;
    registerInferenceCallback = undefined;
    unregisterInferenceCallback = undefined;
    vi.mocked(filesystemMonitoring.createFileSystemWatcher).mockReturnValue(mockWatcher);
    vi.mocked(safeStorageRegistry.getExtensionStorage).mockReturnValue(extensionStorageMock);
    manager = new SecretManager(
      apiSender,
      ipcHandle,
      openshellAdapter,
      providerRegistry,
      configurationRegistry,
      safeStorageRegistry,
      openshellGateway,
    );
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

  test('listServices delegates to openshellAdapter', async () => {
    const profiles = [{ id: 'openai', display_name: 'OpenAI', description: 'OpenAI API provider' }];
    vi.mocked(openshellCli.listProfiles).mockResolvedValue(profiles);

    const result = await manager.listServices();

    expect(result).toEqual(profiles);
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

describe('inference connection lifecycle', () => {
  const mockConnection: InferenceProviderConnection = {
    id: 'conn-123',
    name: 'test-connection',
    type: 'cloud',
    sdk: {} as InferenceProviderConnection['sdk'],
    status: () => 'started',
    models: [{ label: 'model-1' }],
    credentials: () => ({ token: 'secret-token' }),
  };

  function setupConfigMocks(secretType: string, flags?: string): void {
    const properties = {
      'cursor.connection._type': {
        scope: 'InferenceProviderConnection',
        extension: { id: 'kaiden.cursor' },
        title: 'Cursor',
        parentId: 'cursor',
      },
      'cursor.connection.token': {
        scope: 'InferenceProviderConnection',
        extension: { id: 'kaiden.cursor' },
        format: 'password',
        title: 'Cursor',
        parentId: 'cursor',
      },
    } as Record<string, Record<string, unknown>>;
    if (flags) {
      properties['cursor.connection._flags'] = {
        scope: 'InferenceProviderConnection',
        extension: { id: 'kaiden.cursor' },
        title: 'Cursor',
        parentId: 'cursor',
      };
    }

    vi.mocked(configurationRegistry.getConfigurationProperties).mockReturnValue(
      properties as unknown as ReturnType<typeof configurationRegistry.getConfigurationProperties>,
    );
    vi.mocked(configurationRegistry.getConfiguration).mockReturnValue({
      get: vi.fn((key: string) => {
        if (key === 'cursor.connection._type') return secretType;
        if (key === 'cursor.connection.token') return 'cursor:conn-123:token';
        if (key === 'cursor.connection._flags') return flags;
        return undefined;
      }),
      has: vi.fn(),
      update: vi.fn(),
    } as unknown as ReturnType<typeof configurationRegistry.getConfiguration>);

    vi.mocked(extensionStorageMock.get).mockResolvedValue('actual-api-key');
    vi.mocked(openshellCli.listProviders).mockResolvedValue([]);
    vi.mocked(openshellCli.createProvider).mockResolvedValue(undefined);
    vi.mocked(providerRegistry.getProvider).mockReturnValue({
      extensionId: 'kaiden.cursor',
    } as unknown as ProviderImpl);
  }

  test('creates openshell provider on inference connection register', async () => {
    setupConfigMocks('cursor');

    registerInferenceCallback!({
      providerId: 'kaiden.cursor',
      connection: mockConnection,
    });

    await vi.waitFor(() => {
      expect(openshellCli.createProvider).toHaveBeenCalledWith({
        name: 'kaiden.cursor-conn-123',
        type: 'cursor',
        credentials: { token: 'actual-api-key' },
      });
    });
  });

  test('skips creation when provider with same name already exists', async () => {
    setupConfigMocks('cursor');

    vi.mocked(openshellCli.listProviders).mockResolvedValue([{ name: 'kaiden.cursor-conn-123', type: 'cursor' }]);

    registerInferenceCallback!({
      providerId: 'kaiden.cursor',
      connection: mockConnection,
    });

    await new Promise(resolve => setTimeout(resolve, 50));
    expect(openshellCli.createProvider).not.toHaveBeenCalled();
  });

  test('deletes openshell provider on inference connection unregister', async () => {
    setupConfigMocks('cursor');

    registerInferenceCallback!({
      providerId: 'kaiden.cursor',
      connection: mockConnection,
    });

    await vi.waitFor(() => {
      expect(openshellCli.createProvider).toHaveBeenCalled();
    });

    vi.mocked(openshellCli.listProviders).mockResolvedValue([{ name: 'kaiden.cursor-conn-123', type: 'cursor' }]);
    vi.mocked(openshellCli.deleteProvider).mockResolvedValue(undefined);

    unregisterInferenceCallback!({
      providerId: 'kaiden.cursor',
      connection: mockConnection,
    });

    await vi.waitFor(() => {
      expect(openshellCli.deleteProvider).toHaveBeenCalledWith('kaiden.cursor-conn-123');
    });
  });

  test('skips creation when no _type config property exists', async () => {
    vi.mocked(configurationRegistry.getConfigurationProperties).mockReturnValue({});
    vi.mocked(configurationRegistry.getConfiguration).mockReturnValue({
      get: vi.fn(() => undefined),
      has: vi.fn(),
      update: vi.fn(),
    } as unknown as ReturnType<typeof configurationRegistry.getConfiguration>);

    registerInferenceCallback!({
      providerId: 'kaiden.ramalama',
      connection: mockConnection,
    });

    await new Promise(resolve => setTimeout(resolve, 50));
    expect(openshellCli.createProvider).not.toHaveBeenCalled();
  });

  test('getSecretForModel returns SecretInfo matching by name', async () => {
    vi.mocked(providerRegistry.getInferenceConnection).mockReturnValue({
      connection: mockConnection,
      providerId: 'kaiden.cursor',
    });
    vi.mocked(openshellCli.listProviders).mockResolvedValue([
      { name: 'other-provider', type: 'other' },
      { name: 'kaiden.cursor-conn-123', type: 'cursor' },
    ]);

    const secret = await manager.getSecretForModel('cursor::model-1::');
    expect(secret).toEqual({ name: 'kaiden.cursor-conn-123', type: 'cursor' });
  });

  test('getSecretForModel returns undefined for unknown model', async () => {
    vi.mocked(providerRegistry.getInferenceConnection).mockReturnValue(undefined);

    const secret = await manager.getSecretForModel('unknown::model::');
    expect(secret).toBeUndefined();
  });

  test('getSecretForModel returns correct type for vertex-ai provider', async () => {
    vi.mocked(providerRegistry.getInferenceConnection).mockReturnValue({
      connection: mockConnection,
      providerId: 'kaiden.vertex-ai',
    });
    vi.mocked(openshellCli.listProviders).mockResolvedValue([{ name: 'kaiden.vertex-ai-conn-123', type: 'vertex-ai' }]);

    const secret = await manager.getSecretForModel('vertexai::model-1::');
    expect(secret).toEqual({ name: 'kaiden.vertex-ai-conn-123', type: 'vertex-ai' });
  });
});

describe('createSecretForConnection', () => {
  const mockConnection: InferenceProviderConnection = {
    id: 'conn-456',
    name: 'test-connection',
    type: 'cloud',
    sdk: {} as InferenceProviderConnection['sdk'],
    status: () => 'started',
    models: [{ label: 'model-1' }],
    credentials: () => ({ token: 'secret-token' }),
  };

  function setupConfigMocksForCreate(secretType: string): void {
    const properties = {
      'cursor.connection._type': {
        scope: 'InferenceProviderConnection',
        extension: { id: 'kaiden.cursor' },
        title: 'Cursor',
        parentId: 'cursor',
      },
      'cursor.connection.token': {
        scope: 'InferenceProviderConnection',
        extension: { id: 'kaiden.cursor' },
        format: 'password',
        title: 'Cursor',
        parentId: 'cursor',
      },
    } as Record<string, Record<string, unknown>>;

    vi.mocked(configurationRegistry.getConfigurationProperties).mockReturnValue(
      properties as unknown as ReturnType<typeof configurationRegistry.getConfigurationProperties>,
    );
    vi.mocked(configurationRegistry.getConfiguration).mockReturnValue({
      get: vi.fn((key: string) => {
        if (key === 'cursor.connection._type') return secretType;
        if (key === 'cursor.connection.token') return 'cursor:conn-456:token';
        return undefined;
      }),
      has: vi.fn(),
      update: vi.fn(),
    } as unknown as ReturnType<typeof configurationRegistry.getConfiguration>);

    vi.mocked(extensionStorageMock.get).mockResolvedValue('actual-api-key');
    vi.mocked(openshellCli.listProviders).mockResolvedValue([]);
    vi.mocked(openshellCli.createProvider).mockResolvedValue(undefined);
    vi.mocked(providerRegistry.getProvider).mockReturnValue({
      extensionId: 'kaiden.cursor',
    } as unknown as ProviderImpl);
  }

  test('creates secret and returns SecretInfo when none exists', async () => {
    setupConfigMocksForCreate('cursor');

    const result = await manager.createSecretForConnection('kaiden.cursor', mockConnection, false);

    expect(openshellCli.createProvider).toHaveBeenCalledWith({
      name: 'kaiden.cursor-conn-456',
      type: 'cursor',
      credentials: { token: 'actual-api-key' },
    });
    expect(result).toEqual({ name: 'kaiden.cursor-conn-456', type: 'cursor' });
  });

  test('returns undefined when _type is not configured', async () => {
    vi.mocked(configurationRegistry.getConfigurationProperties).mockReturnValue({});
    vi.mocked(configurationRegistry.getConfiguration).mockReturnValue({
      get: vi.fn(() => undefined),
      has: vi.fn(),
      update: vi.fn(),
    } as unknown as ReturnType<typeof configurationRegistry.getConfiguration>);
    vi.mocked(providerRegistry.getProvider).mockReturnValue({
      extensionId: 'kaiden.cursor',
    } as unknown as ProviderImpl);

    const result = await manager.createSecretForConnection('kaiden.cursor', mockConnection, false);

    expect(result).toBeUndefined();
    expect(openshellCli.createProvider).not.toHaveBeenCalled();
  });

  test('returns undefined when secret already exists', async () => {
    setupConfigMocksForCreate('cursor');
    vi.mocked(openshellCli.listProviders).mockResolvedValue([{ name: 'kaiden.cursor-conn-456', type: 'cursor' }]);

    const result = await manager.createSecretForConnection('kaiden.cursor', mockConnection, true);

    expect(result).toBeUndefined();
    expect(openshellCli.createProvider).not.toHaveBeenCalled();
  });
});

describe('ensureSecretForModel', () => {
  const mockConnection: InferenceProviderConnection = {
    id: 'conn-789',
    name: 'test-connection',
    type: 'cloud',
    sdk: {} as InferenceProviderConnection['sdk'],
    status: () => 'started',
    models: [{ label: 'model-1' }],
    credentials: () => ({ token: 'secret-token' }),
  };

  test('returns existing secret without creating', async () => {
    vi.mocked(providerRegistry.getInferenceConnection).mockReturnValue({
      connection: mockConnection,
      providerId: 'kaiden.cursor',
    });
    vi.mocked(openshellCli.listProviders).mockResolvedValue([{ name: 'kaiden.cursor-conn-789', type: 'cursor' }]);

    const result = await manager.ensureSecretForModel('cursor::model-1::');

    expect(result).toEqual({ name: 'kaiden.cursor-conn-789', type: 'cursor' });
    expect(openshellCli.createProvider).not.toHaveBeenCalled();
  });

  test('creates and returns secret when missing but connection exists', async () => {
    vi.mocked(providerRegistry.getInferenceConnection).mockReturnValue({
      connection: mockConnection,
      providerId: 'kaiden.cursor',
    });
    // First call from getSecretForModel: secret not found
    // Second call from createSecretForConnection: still not found (dedup check)
    vi.mocked(openshellCli.listProviders).mockResolvedValue([]);
    vi.mocked(openshellCli.createProvider).mockResolvedValue(undefined);
    vi.mocked(providerRegistry.getProvider).mockReturnValue({
      extensionId: 'kaiden.cursor',
    } as unknown as ProviderImpl);

    const properties = {
      'cursor.connection._type': {
        scope: 'InferenceProviderConnection',
        extension: { id: 'kaiden.cursor' },
        title: 'Cursor',
        parentId: 'cursor',
      },
      'cursor.connection.token': {
        scope: 'InferenceProviderConnection',
        extension: { id: 'kaiden.cursor' },
        format: 'password',
        title: 'Cursor',
        parentId: 'cursor',
      },
    } as Record<string, Record<string, unknown>>;
    vi.mocked(configurationRegistry.getConfigurationProperties).mockReturnValue(
      properties as unknown as ReturnType<typeof configurationRegistry.getConfigurationProperties>,
    );
    vi.mocked(configurationRegistry.getConfiguration).mockReturnValue({
      get: vi.fn((key: string) => {
        if (key === 'cursor.connection._type') return 'cursor';
        if (key === 'cursor.connection.token') return 'cursor:conn-789:token';
        return undefined;
      }),
      has: vi.fn(),
      update: vi.fn(),
    } as unknown as ReturnType<typeof configurationRegistry.getConfiguration>);
    vi.mocked(extensionStorageMock.get).mockResolvedValue('actual-api-key');

    const result = await manager.ensureSecretForModel('cursor::model-1::');

    expect(openshellCli.createProvider).toHaveBeenCalled();
    expect(result).toEqual({ name: 'kaiden.cursor-conn-789', type: 'cursor' });
  });

  test('returns undefined when no inference connection found', async () => {
    vi.mocked(providerRegistry.getInferenceConnection).mockReturnValue(undefined);

    const result = await manager.ensureSecretForModel('unknown::model::');

    expect(result).toBeUndefined();
    expect(openshellCli.createProvider).not.toHaveBeenCalled();
  });
});
