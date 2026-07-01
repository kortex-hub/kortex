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

import { randomUUID } from 'node:crypto';

import { createGoogle, type GoogleProvider } from '@ai-sdk/google';
import type { Model, Pager } from '@google/genai';
import { GoogleGenAI } from '@google/genai';
import type {
  CancellationToken,
  Configuration,
  Disposable,
  Logger,
  Provider,
  provider as ProviderAPI,
  SecretStorage,
} from '@openkaiden/api';
import { configuration } from '@openkaiden/api';
import { assert, beforeEach, describe, expect, test, vi } from 'vitest';

import { Gemini, PROVIDER_ID, type StoredConnection, TOKENS_KEY } from './gemini';

vi.mock(import('node:crypto'), async importOriginal => {
  const actual = await importOriginal();
  return {
    ...actual,
    randomUUID: vi.fn().mockReturnValue('fake-uuid-1'),
  };
});

vi.mock('@openkaiden/api', () => ({
  Disposable: {
    create: (func: () => void): Disposable => {
      return {
        dispose: func,
      };
    },
    from: vi.fn(),
  },
  configuration: {
    getConfiguration: vi.fn(),
  },
}));

vi.mock(import('@ai-sdk/google'), () => ({
  createGoogle: vi.fn(),
}));

vi.mock(import('@google/genai'));

const GOOGLE_AI_PROVIDER_MOCK: GoogleProvider = {} as unknown as GoogleProvider;

const PROVIDER_API_MOCK: typeof ProviderAPI = {
  createProvider: vi.fn(),
} as unknown as typeof ProviderAPI;

const PROVIDER_MOCK: Provider = {
  id: 'gemini',
  name: 'Gemini',
  setInferenceProviderConnectionFactory: vi.fn(),
  registerInferenceProviderConnection: vi.fn(),
} as unknown as Provider;

const SAFE_STORAGE_MOCK: SecretStorage = {
  get: vi.fn(),
  store: vi.fn(),
  delete: vi.fn(),
  onDidChange: vi.fn(),
};

const CONFIG_UPDATE_MOCK = vi.fn();

const CONFIGURATION_MOCK: Configuration = {
  get: vi.fn(),
  has: vi.fn(),
  update: CONFIG_UPDATE_MOCK,
} as unknown as Configuration;

beforeEach(() => {
  vi.resetAllMocks();

  vi.mocked(randomUUID).mockReturnValue('fake-uuid-1' as ReturnType<typeof randomUUID>);
  vi.mocked(PROVIDER_API_MOCK.createProvider).mockReturnValue(PROVIDER_MOCK as Provider);
  vi.mocked(createGoogle).mockReturnValue(GOOGLE_AI_PROVIDER_MOCK);
  vi.mocked(configuration.getConfiguration).mockReturnValue(CONFIGURATION_MOCK);

  // Mock GoogleGenAI prototype models.list to return async iterable Pager
  const mockModels: Model[] = [
    {
      name: 'models/gemini-2.5-flash',
      version: 'Latest',
      supportedActions: ['generateContent'],
    } as Model,
    {
      name: 'models/gemini-2.5-pro',
      version: 'Latest',
      supportedActions: ['generateContent'],
    } as Model,
    {
      name: 'models/gemini-model1',
      version: '1.0.0',
      supportedActions: ['generateContent'],
    } as Model,
    {
      name: 'models/gemini-model2',
      version: 'Latest',
      supportedActions: ['fooBar'],
    } as Model,
  ];

  // Create async iterable mock
  const mockPager = {
    async *[Symbol.asyncIterator]() {
      for (const model of mockModels) {
        yield model;
      }
    },
  } as unknown as Pager<Model>;

  const mockList = vi.fn().mockResolvedValue(mockPager);
  (vi.mocked(GoogleGenAI.prototype) as unknown as { models: { list: typeof mockList } }).models = { list: mockList };
});

test('constructor should not do anything', async () => {
  const gemini = new Gemini(PROVIDER_API_MOCK, SAFE_STORAGE_MOCK);
  expect(gemini).instanceof(Gemini);

  expect(PROVIDER_API_MOCK.createProvider).not.toHaveBeenCalled();
});

describe('init', () => {
  test('should register provider', async () => {
    const gemini = new Gemini(PROVIDER_API_MOCK, SAFE_STORAGE_MOCK);
    await gemini.init();

    expect(PROVIDER_API_MOCK.createProvider).toHaveBeenCalledOnce();
    expect(PROVIDER_API_MOCK.createProvider).toHaveBeenCalledWith({
      name: 'Gemini',
      status: 'unknown',
      id: 'gemini',
      images: {
        icon: './icon.png',
        logo: {
          dark: './icon.png',
          light: './icon.png',
        },
      },
    });
  });

  test('should register inference factory', async () => {
    const gemini = new Gemini(PROVIDER_API_MOCK, SAFE_STORAGE_MOCK);
    await gemini.init();

    expect(PROVIDER_MOCK.setInferenceProviderConnectionFactory).toHaveBeenCalledOnce();
    expect(PROVIDER_MOCK.setInferenceProviderConnectionFactory).toHaveBeenCalledWith({
      connectionTypes: ['cloud'],
      llmMetadata: { name: 'gemini' },
      create: expect.any(Function),
    });
  });

  test('should restore connections from secret storage', async () => {
    const stored: StoredConnection[] = [{ id: 'persisted-id', token: 'existingKey' }];
    vi.mocked(SAFE_STORAGE_MOCK.get).mockResolvedValue(JSON.stringify(stored));

    const gemini = new Gemini(PROVIDER_API_MOCK, SAFE_STORAGE_MOCK);
    await gemini.init();

    expect(SAFE_STORAGE_MOCK.get).toHaveBeenCalledWith(TOKENS_KEY);
    expect(PROVIDER_MOCK.registerInferenceProviderConnection).toHaveBeenCalledOnce();
    expect(PROVIDER_MOCK.registerInferenceProviderConnection).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'persisted-id' }),
    );
  });

  test('should handle empty secret storage', async () => {
    vi.mocked(SAFE_STORAGE_MOCK.get).mockResolvedValue(undefined);

    const gemini = new Gemini(PROVIDER_API_MOCK, SAFE_STORAGE_MOCK);
    await gemini.init();

    expect(PROVIDER_MOCK.registerInferenceProviderConnection).not.toHaveBeenCalled();
  });

  test('should migrate legacy comma-separated tokens to JSON format', async () => {
    vi.mocked(randomUUID)
      .mockReturnValueOnce('migrated-id-1' as ReturnType<typeof randomUUID>)
      .mockReturnValueOnce('migrated-id-2' as ReturnType<typeof randomUUID>);
    vi.mocked(SAFE_STORAGE_MOCK.get).mockResolvedValue('tokenA,tokenB');

    const gemini = new Gemini(PROVIDER_API_MOCK, SAFE_STORAGE_MOCK);
    await gemini.init();

    const expected: StoredConnection[] = [
      { id: 'migrated-id-1', token: 'tokenA' },
      { id: 'migrated-id-2', token: 'tokenB' },
    ];
    expect(SAFE_STORAGE_MOCK.store).toHaveBeenCalledWith(TOKENS_KEY, JSON.stringify(expected));
    expect(PROVIDER_MOCK.registerInferenceProviderConnection).toHaveBeenCalledTimes(2);
    expect(PROVIDER_MOCK.registerInferenceProviderConnection).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'migrated-id-1' }),
    );
    expect(PROVIDER_MOCK.registerInferenceProviderConnection).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'migrated-id-2' }),
    );
  });

  test('should restore persisted IDs across restarts', async () => {
    const stored: StoredConnection[] = [
      { id: 'stable-id-1', token: 'key1' },
      { id: 'stable-id-2', token: 'key2' },
    ];
    vi.mocked(SAFE_STORAGE_MOCK.get).mockResolvedValue(JSON.stringify(stored));

    const gemini = new Gemini(PROVIDER_API_MOCK, SAFE_STORAGE_MOCK);
    await gemini.init();

    expect(PROVIDER_MOCK.registerInferenceProviderConnection).toHaveBeenCalledTimes(2);
    expect(PROVIDER_MOCK.registerInferenceProviderConnection).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'stable-id-1' }),
    );
    expect(PROVIDER_MOCK.registerInferenceProviderConnection).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'stable-id-2' }),
    );
  });
});

describe('factory', () => {
  let create: (params: { [key: string]: unknown }, logger?: Logger, token?: CancellationToken) => Promise<void>;
  beforeEach(async () => {
    const gemini = new Gemini(PROVIDER_API_MOCK, SAFE_STORAGE_MOCK);
    await gemini.init();

    const mock = vi.mocked(PROVIDER_MOCK.setInferenceProviderConnectionFactory);
    assert(mock, 'setInferenceProviderConnectionFactory must be defined');
    create = mock.mock.calls[0][0].create;
  });

  test('calling create without params should throw', async () => {
    await expect(() => {
      return create({});
    }).rejects.toThrowError('invalid apiKey');
  });

  test('calling create with proper params should save connection as JSON', async () => {
    await create({
      'gemini.factory.apiKey': 'dummyKey',
    });

    // Verify both the tokens list and per-connection secret are stored
    const expected: StoredConnection[] = [{ id: 'fake-uuid-1', token: 'dummyKey' }];
    expect(SAFE_STORAGE_MOCK.store).toHaveBeenCalledWith(TOKENS_KEY, JSON.stringify(expected));
  });

  test('calling create with proper params should register inference connection', async () => {
    await create({
      'gemini.factory.apiKey': 'dummyKey',
    });

    // ensure the key is used to create a google client
    expect(createGoogle).toHaveBeenCalledOnce();
    expect(createGoogle).toHaveBeenCalledWith({
      apiKey: 'dummyKey',
    });

    // ensure GoogleGenAI was created for fetching models
    expect(GoogleGenAI).toHaveBeenCalledWith({
      apiKey: 'dummyKey',
    });

    expect(PROVIDER_MOCK.registerInferenceProviderConnection).toHaveBeenCalledOnce();
    expect(PROVIDER_MOCK.registerInferenceProviderConnection).toHaveBeenCalledWith({
      id: 'fake-uuid-1',
      name: 'dum*****',
      type: 'cloud',
      llmMetadata: { name: 'gemini' },
      status: expect.any(Function),
      lifecycle: {
        delete: expect.any(Function),
      },
      sdk: GOOGLE_AI_PROVIDER_MOCK,
      models: [{ label: 'gemini-2.5-flash' }, { label: 'gemini-2.5-pro' }],
      credentials: expect.any(Function),
    });
  });

  test('should rollback saved config if registration fails', async () => {
    vi.mocked(PROVIDER_MOCK.registerInferenceProviderConnection).mockImplementation(() => {
      throw new Error('registration boom');
    });

    await expect(
      create({
        'gemini.factory.apiKey': 'dummyKey',
      }),
    ).rejects.toThrow('registration boom');

    expect(SAFE_STORAGE_MOCK.delete).toHaveBeenCalledWith('gemini:fake-uuid-1:token');
    expect(CONFIG_UPDATE_MOCK).toHaveBeenCalledWith('gemini.connection._type', undefined);
    expect(CONFIG_UPDATE_MOCK).toHaveBeenCalledWith('gemini.connection.GEMINI_API_KEY', undefined);
  });
});

describe('connection delete lifecycle', () => {
  let gemini: Gemini;
  let mDelete: (logger?: Logger) => Promise<void>;
  const disposeMock = vi.fn();

  beforeEach(async () => {
    vi.mocked(PROVIDER_MOCK.registerInferenceProviderConnection).mockReturnValue({
      dispose: disposeMock,
    });

    gemini = new Gemini(PROVIDER_API_MOCK, SAFE_STORAGE_MOCK);
    await gemini.init();

    // Get the create factory
    const mock = vi.mocked(PROVIDER_MOCK.setInferenceProviderConnectionFactory);
    const create = mock.mock.calls[0][0].create;

    await create({
      'gemini.factory.apiKey': 'dummyKey',
    });

    const registerMock = vi.mocked(PROVIDER_MOCK.registerInferenceProviderConnection);
    const lifecycle = registerMock.mock.calls[0][0].lifecycle;
    assert(lifecycle?.delete, 'delete method of lifecycle must be defined');

    mDelete = lifecycle.delete;
  });

  test('calling delete should remove the connection from storage, clear configuration, and dispose', async () => {
    await mDelete();

    // Verify secret deletion
    expect(SAFE_STORAGE_MOCK.delete).toHaveBeenCalledWith(`${PROVIDER_ID}:fake-uuid-1:token`);

    // Verify configuration clearing
    expect(CONFIG_UPDATE_MOCK).toHaveBeenCalledWith('gemini.connection._type', undefined);
    expect(CONFIG_UPDATE_MOCK).toHaveBeenCalledWith('gemini.connection.GEMINI_API_KEY', undefined);

    // Verify storage update - the tokens list is updated after per-connection secret
    expect(SAFE_STORAGE_MOCK.store).toHaveBeenCalledWith(TOKENS_KEY, JSON.stringify([]));

    // Verify disposal
    expect(disposeMock).toHaveBeenCalledOnce();
  });

  test('calling delete should remove connection by ID, not by token value', async () => {
    // Setup: simulate two connections with same token but different IDs
    const multipleConnections: StoredConnection[] = [
      { id: 'id-1', token: 'sharedToken' },
      { id: 'id-2', token: 'sharedToken' },
    ];
    vi.mocked(SAFE_STORAGE_MOCK.get).mockResolvedValue(JSON.stringify(multipleConnections));

    vi.mocked(PROVIDER_MOCK.registerInferenceProviderConnection).mockClear();
    vi.mocked(SAFE_STORAGE_MOCK.store).mockClear();
    const gemini2 = new Gemini(PROVIDER_API_MOCK, SAFE_STORAGE_MOCK);
    await gemini2.init();

    // Get the delete function for the restored id-1 connection
    const registerMock2 = vi.mocked(PROVIDER_MOCK.registerInferenceProviderConnection);
    expect(registerMock2).toHaveBeenCalledTimes(2);
    const lifecycle2 = registerMock2.mock.calls[0][0].lifecycle;
    assert(lifecycle2?.delete, 'delete method must be defined');

    await lifecycle2.delete();

    // Verify only the connection with id-1 was removed, id-2 remains
    const expectedAfterDelete: StoredConnection[] = [{ id: 'id-2', token: 'sharedToken' }];
    expect(SAFE_STORAGE_MOCK.store).toHaveBeenCalledWith(TOKENS_KEY, JSON.stringify(expectedAfterDelete));
  });
});

describe('workspace configuration', () => {
  beforeEach(async () => {
    vi.mocked(PROVIDER_MOCK.registerInferenceProviderConnection).mockReturnValue({
      dispose: vi.fn(),
    });
  });

  test('should store per-connection secret and set configuration after registration', async () => {
    const gemini = new Gemini(PROVIDER_API_MOCK, SAFE_STORAGE_MOCK);
    await gemini.init();

    const mock = vi.mocked(PROVIDER_MOCK.setInferenceProviderConnectionFactory);
    const create = mock.mock.calls[0][0].create;

    await create({
      'gemini.factory.apiKey': 'dummyKey',
    });

    // Verify per-connection secret storage
    expect(SAFE_STORAGE_MOCK.store).toHaveBeenCalledWith(`${PROVIDER_ID}:fake-uuid-1:token`, 'dummyKey');

    // Verify configuration.getConfiguration was called with the connection
    const connection = vi.mocked(PROVIDER_MOCK.registerInferenceProviderConnection).mock.calls[0][0];
    expect(configuration.getConfiguration).toHaveBeenCalledWith(undefined, connection);

    // Verify configuration updates
    expect(CONFIG_UPDATE_MOCK).toHaveBeenCalledWith('gemini.connection._type', PROVIDER_ID);
    expect(CONFIG_UPDATE_MOCK).toHaveBeenCalledWith(
      'gemini.connection.GEMINI_API_KEY',
      `${PROVIDER_ID}:fake-uuid-1:token`,
    );
  });

  test('should set workspace configuration for each restored connection', async () => {
    const stored: StoredConnection[] = [
      { id: 'id-1', token: 'key1' },
      { id: 'id-2', token: 'key2' },
    ];
    vi.mocked(SAFE_STORAGE_MOCK.get).mockResolvedValue(JSON.stringify(stored));

    const gemini = new Gemini(PROVIDER_API_MOCK, SAFE_STORAGE_MOCK);
    await gemini.init();

    // Verify per-connection secrets stored
    expect(SAFE_STORAGE_MOCK.store).toHaveBeenCalledWith(`${PROVIDER_ID}:id-1:token`, 'key1');
    expect(SAFE_STORAGE_MOCK.store).toHaveBeenCalledWith(`${PROVIDER_ID}:id-2:token`, 'key2');

    // Verify configuration updates for both connections
    expect(CONFIG_UPDATE_MOCK).toHaveBeenCalledWith('gemini.connection._type', PROVIDER_ID);
    expect(CONFIG_UPDATE_MOCK).toHaveBeenCalledWith('gemini.connection.GEMINI_API_KEY', `${PROVIDER_ID}:id-1:token`);
    expect(CONFIG_UPDATE_MOCK).toHaveBeenCalledWith('gemini.connection.GEMINI_API_KEY', `${PROVIDER_ID}:id-2:token`);
  });
});
