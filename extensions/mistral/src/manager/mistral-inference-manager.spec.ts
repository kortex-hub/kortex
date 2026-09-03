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

import { randomUUID } from 'node:crypto';

import { createMistral, type MistralProvider } from '@ai-sdk/mistral';
import { Mistral } from '@mistralai/mistralai';
import type { CancellationToken, Configuration, Disposable, Logger, Provider, SecretStorage } from '@openkaiden/api';
import { configuration } from '@openkaiden/api';
import { Container } from 'inversify';
import { assert, beforeEach, describe, expect, test, vi } from 'vitest';

import { MistralProviderSymbol, SecretStorageSymbol } from '/@/inject/symbol';
import { PROVIDER_ID } from '/@/mistral-extension';

import { MistralInferenceManager, type StoredConnection, TOKENS_KEY } from './mistral-inference-manager';

vi.mock(import('node:crypto'), async importOriginal => {
  const actual = await importOriginal();
  return {
    ...actual,
    randomUUID: vi.fn().mockReturnValue('fake-uuid-1'),
  };
});

vi.mock(import('@ai-sdk/mistral'));

const mockList = vi.fn();

vi.mock(import('@mistralai/mistralai'), async () => {
  return {
    Mistral: vi.fn().mockImplementation(function () {
      return {
        models: {
          list: mockList,
        },
      };
    }),
  };
});

const MISTRAL_PROVIDER_MOCK: MistralProvider = {} as unknown as MistralProvider;

const PROVIDER_MOCK: Provider = {
  setInferenceProviderConnectionFactory: vi.fn(),
  registerInferenceProviderConnection: vi.fn(),
} as unknown as Provider;

const SECRET_STORAGE_MOCK: SecretStorage = {
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
  vi.mocked(createMistral).mockReturnValue(MISTRAL_PROVIDER_MOCK);
  vi.mocked(configuration.getConfiguration).mockReturnValue(CONFIGURATION_MOCK);

  vi.mocked(Mistral).mockImplementation(function () {
    return {
      models: {
        list: mockList,
      },
    };
  } as unknown as (...args: unknown[]) => Mistral);

  mockList.mockResolvedValue({
    data: [
      { id: 'mistral-large-latest', capabilities: { completionChat: true } },
      { id: 'mistral-small-latest', capabilities: { completionChat: true } },
    ],
  });
});

async function createManager(): Promise<MistralInferenceManager> {
  const container = new Container();
  container.bind(MistralInferenceManager).toSelf();
  container.bind(MistralProviderSymbol).toConstantValue(PROVIDER_MOCK);
  container.bind(SecretStorageSymbol).toConstantValue(SECRET_STORAGE_MOCK);
  return container.getAsync<MistralInferenceManager>(MistralInferenceManager);
}

describe('init', () => {
  test('should register inference factory', async () => {
    const manager = await createManager();
    await manager.init();

    expect(PROVIDER_MOCK.setInferenceProviderConnectionFactory).toHaveBeenCalledOnce();
    expect(PROVIDER_MOCK.setInferenceProviderConnectionFactory).toHaveBeenCalledWith({
      connectionTypes: ['cloud'],
      llmMetadata: { name: 'mistral' },
      create: expect.any(Function),
    });
  });

  test('should restore connections from secret storage', async () => {
    const stored: StoredConnection[] = [{ id: 'persisted-id', token: 'existingKey' }];
    vi.mocked(SECRET_STORAGE_MOCK.get).mockResolvedValue(JSON.stringify(stored));

    const manager = await createManager();
    await manager.init();

    expect(SECRET_STORAGE_MOCK.get).toHaveBeenCalledWith(TOKENS_KEY);
    expect(PROVIDER_MOCK.registerInferenceProviderConnection).toHaveBeenCalledOnce();
    expect(PROVIDER_MOCK.registerInferenceProviderConnection).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'persisted-id' }),
    );
  });

  test('should handle empty secret storage', async () => {
    vi.mocked(SECRET_STORAGE_MOCK.get).mockResolvedValue(undefined);

    const manager = await createManager();
    await manager.init();

    expect(PROVIDER_MOCK.registerInferenceProviderConnection).not.toHaveBeenCalled();
  });

  test('should migrate legacy comma-separated tokens to JSON format', async () => {
    vi.mocked(randomUUID)
      .mockReturnValueOnce('migrated-id-1' as ReturnType<typeof randomUUID>)
      .mockReturnValueOnce('migrated-id-2' as ReturnType<typeof randomUUID>);
    vi.mocked(SECRET_STORAGE_MOCK.get).mockResolvedValue('tokenA,tokenB');

    const manager = await createManager();
    await manager.init();

    const expected: StoredConnection[] = [
      { id: 'migrated-id-1', token: 'tokenA' },
      { id: 'migrated-id-2', token: 'tokenB' },
    ];
    expect(SECRET_STORAGE_MOCK.store).toHaveBeenCalledWith(TOKENS_KEY, JSON.stringify(expected));
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
    vi.mocked(SECRET_STORAGE_MOCK.get).mockResolvedValue(JSON.stringify(stored));

    const manager = await createManager();
    await manager.init();

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
    const manager = await createManager();
    await manager.init();

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
      'mistral.factory.apiKey': 'dummyKey',
    });

    const expected: StoredConnection[] = [{ id: 'fake-uuid-1', token: 'dummyKey' }];
    expect(SECRET_STORAGE_MOCK.store).toHaveBeenCalledWith(TOKENS_KEY, JSON.stringify(expected));
  });

  test('calling create with proper params should register inference connection', async () => {
    await create({
      'mistral.factory.apiKey': 'dummyKey',
    });

    expect(createMistral).toHaveBeenCalledOnce();
    expect(createMistral).toHaveBeenCalledWith({
      apiKey: 'dummyKey',
    });

    expect(Mistral).toHaveBeenCalledWith({
      apiKey: 'dummyKey',
    });

    expect(PROVIDER_MOCK.registerInferenceProviderConnection).toHaveBeenCalledOnce();
    expect(PROVIDER_MOCK.registerInferenceProviderConnection).toHaveBeenCalledWith({
      id: 'fake-uuid-1',
      name: 'dum*****',
      type: 'cloud',
      llmMetadata: { name: 'mistral' },
      status: expect.any(Function),
      lifecycle: {
        delete: expect.any(Function),
      },
      sdk: MISTRAL_PROVIDER_MOCK,
      models: [{ label: 'mistral-large-latest' }, { label: 'mistral-small-latest' }],
      credentials: expect.any(Function),
    });
  });

  test('should rollback saved config if registration fails', async () => {
    vi.mocked(PROVIDER_MOCK.registerInferenceProviderConnection).mockImplementation(() => {
      throw new Error('registration boom');
    });

    await expect(
      create({
        'mistral.factory.apiKey': 'dummyKey',
      }),
    ).rejects.toThrow('registration boom');

    expect(SECRET_STORAGE_MOCK.delete).toHaveBeenCalledWith('mistral:fake-uuid-1:token');
    expect(CONFIG_UPDATE_MOCK).toHaveBeenCalledWith('mistral.connection._type', undefined);
    expect(CONFIG_UPDATE_MOCK).toHaveBeenCalledWith('mistral.connection.token', undefined);
  });
});

describe('connection delete lifecycle', () => {
  let manager: MistralInferenceManager;
  let mDelete: (logger?: Logger) => Promise<void>;
  const disposeMock = vi.fn();

  beforeEach(async () => {
    vi.mocked(PROVIDER_MOCK.registerInferenceProviderConnection).mockReturnValue({
      dispose: disposeMock,
    } as unknown as Disposable);

    manager = await createManager();
    await manager.init();

    const mock = vi.mocked(PROVIDER_MOCK.setInferenceProviderConnectionFactory);
    const create = mock.mock.calls[0][0].create;

    await create({
      'mistral.factory.apiKey': 'dummyKey',
    });

    const registerMock = vi.mocked(PROVIDER_MOCK.registerInferenceProviderConnection);
    const lifecycle = registerMock.mock.calls[0][0].lifecycle;
    assert(lifecycle?.delete, 'delete method of lifecycle must be defined');

    mDelete = lifecycle.delete;
  });

  test('calling delete should remove the connection from storage, clear configuration, and dispose', async () => {
    await mDelete();

    expect(SECRET_STORAGE_MOCK.delete).toHaveBeenCalledWith(`${PROVIDER_ID}:fake-uuid-1:token`);

    expect(CONFIG_UPDATE_MOCK).toHaveBeenCalledWith('mistral.connection._type', undefined);
    expect(CONFIG_UPDATE_MOCK).toHaveBeenCalledWith('mistral.connection.token', undefined);

    expect(disposeMock).toHaveBeenCalledOnce();
  });
});

describe('workspace configuration', () => {
  beforeEach(async () => {
    vi.mocked(PROVIDER_MOCK.registerInferenceProviderConnection).mockReturnValue({
      dispose: vi.fn(),
    });
  });

  test('should store per-connection secret and set configuration after registration', async () => {
    const manager = await createManager();
    await manager.init();

    const mock = vi.mocked(PROVIDER_MOCK.setInferenceProviderConnectionFactory);
    const create = mock.mock.calls[0][0].create;

    await create({
      'mistral.factory.apiKey': 'dummyKey',
    });

    expect(SECRET_STORAGE_MOCK.store).toHaveBeenCalledWith(`${PROVIDER_ID}:fake-uuid-1:token`, 'dummyKey');

    const connection = vi.mocked(PROVIDER_MOCK.registerInferenceProviderConnection).mock.calls[0][0];
    expect(configuration.getConfiguration).toHaveBeenCalledWith(undefined, connection);

    expect(CONFIG_UPDATE_MOCK).toHaveBeenCalledWith('mistral.connection._type', PROVIDER_ID);
    expect(CONFIG_UPDATE_MOCK).toHaveBeenCalledWith('mistral.connection.token', `${PROVIDER_ID}:fake-uuid-1:token`);
  });

  test('should set workspace configuration for each restored connection', async () => {
    const stored: StoredConnection[] = [
      { id: 'id-1', token: 'key1' },
      { id: 'id-2', token: 'key2' },
    ];
    vi.mocked(SECRET_STORAGE_MOCK.get).mockResolvedValue(JSON.stringify(stored));

    const manager = await createManager();
    await manager.init();

    expect(SECRET_STORAGE_MOCK.store).toHaveBeenCalledWith(`${PROVIDER_ID}:id-1:token`, 'key1');
    expect(SECRET_STORAGE_MOCK.store).toHaveBeenCalledWith(`${PROVIDER_ID}:id-2:token`, 'key2');

    expect(CONFIG_UPDATE_MOCK).toHaveBeenCalledWith('mistral.connection._type', PROVIDER_ID);
    expect(CONFIG_UPDATE_MOCK).toHaveBeenCalledWith('mistral.connection.token', `${PROVIDER_ID}:id-1:token`);
    expect(CONFIG_UPDATE_MOCK).toHaveBeenCalledWith('mistral.connection.token', `${PROVIDER_ID}:id-2:token`);
  });
});

describe('dispose', () => {
  test('should dispose all connections', async () => {
    const disposeMock = vi.fn();
    vi.mocked(PROVIDER_MOCK.registerInferenceProviderConnection).mockReturnValue({
      dispose: disposeMock,
    } as unknown as Disposable);

    const manager = await createManager();
    await manager.init();

    const mock = vi.mocked(PROVIDER_MOCK.setInferenceProviderConnectionFactory);
    const create = mock.mock.calls[0][0].create;

    await create({
      'mistral.factory.apiKey': 'dummyKey',
    });

    manager.dispose();

    expect(disposeMock).toHaveBeenCalledOnce();
  });
});
