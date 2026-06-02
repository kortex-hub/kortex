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

import { createOpenAICompatible, type OpenAICompatibleProvider } from '@ai-sdk/openai-compatible';
import type {
  CancellationToken,
  Disposable,
  Logger,
  Provider,
  provider as ProviderAPI,
  SecretStorage,
} from '@openkaiden/api';
import { assert, beforeEach, describe, expect, test, vi } from 'vitest';

import { OpenAI, type StoredConnection, TOKENS_KEY } from './openAI';

vi.mock(import('node:crypto'));

vi.mock('@openkaiden/api', () => ({
  Disposable: {
    create: (func: () => void): Disposable => {
      return {
        dispose: func,
      };
    },
    from: vi.fn(),
  },
}));

vi.mock(import('@ai-sdk/openai-compatible'), () => ({
  createOpenAICompatible: vi.fn(),
}));

const OPENAI_PROVIDER_MOCK: OpenAICompatibleProvider = {} as unknown as OpenAICompatibleProvider;

const PROVIDER_API_MOCK: typeof ProviderAPI = {
  createProvider: vi.fn(),
} as unknown as typeof ProviderAPI;

const PROVIDER_MOCK: Provider = {
  id: 'openai',
  name: 'OpenAI',
  setInferenceProviderConnectionFactory: vi.fn(),
  registerInferenceProviderConnection: vi.fn(),
} as unknown as Provider;

const SECRET_STORAGE_MOCK: SecretStorage = {
  get: vi.fn(),
  store: vi.fn(),
  delete: vi.fn(),
  onDidChange: vi.fn(),
};

const fetchMock = vi.fn();

global.fetch = fetchMock;

beforeEach(() => {
  vi.resetAllMocks();

  vi.mocked(randomUUID).mockReturnValue('fake-uuid-1' as ReturnType<typeof randomUUID>);
  vi.mocked(PROVIDER_API_MOCK.createProvider).mockReturnValue(PROVIDER_MOCK as Provider);
  vi.mocked(createOpenAICompatible).mockReturnValue(OPENAI_PROVIDER_MOCK);
  vi.mocked(SECRET_STORAGE_MOCK.get).mockResolvedValue(undefined);

  fetchMock.mockResolvedValue({
    status: 200,
    json: async () => ({ data: [{ id: 'gpt-4o' }, { id: 'gpt-4.1' }] }),
  });
});

test('constructor should not do anything', async () => {
  const openai = new OpenAI(PROVIDER_API_MOCK, SECRET_STORAGE_MOCK);
  expect(openai).instanceof(OpenAI);

  expect(PROVIDER_API_MOCK.createProvider).not.toHaveBeenCalled();
});

describe('init', () => {
  test('should register provider', async () => {
    const openai = new OpenAI(PROVIDER_API_MOCK, SECRET_STORAGE_MOCK);
    await openai.init();

    expect(PROVIDER_API_MOCK.createProvider).toHaveBeenCalledOnce();
    expect(PROVIDER_API_MOCK.createProvider).toHaveBeenCalledWith({
      name: 'OpenAI',
      status: 'unknown',
      id: 'openai',
    });
  });

  test('should register inference factory', async () => {
    const openai = new OpenAI(PROVIDER_API_MOCK, SECRET_STORAGE_MOCK);
    await openai.init();

    expect(PROVIDER_MOCK.setInferenceProviderConnectionFactory).toHaveBeenCalledOnce();
    expect(PROVIDER_MOCK.setInferenceProviderConnectionFactory).toHaveBeenCalledWith({
      connectionTypes: ['cloud'],
      create: expect.any(Function),
    });
  });

  test('should not restore any connection if no secrets', async () => {
    const openai = new OpenAI(PROVIDER_API_MOCK, SECRET_STORAGE_MOCK);
    await openai.init();

    expect(PROVIDER_MOCK.registerInferenceProviderConnection).not.toHaveBeenCalled();
  });
});

describe('factory', () => {
  let create: (params: { [key: string]: unknown }, logger?: Logger, token?: CancellationToken) => Promise<void>;
  beforeEach(async () => {
    const openai = new OpenAI(PROVIDER_API_MOCK, SECRET_STORAGE_MOCK);
    await openai.init();

    const mock = vi.mocked(PROVIDER_MOCK.setInferenceProviderConnectionFactory);
    assert(mock, 'setInferenceProviderConnectionFactory must be defined');
    create = mock.mock.calls[0][0].create;
  });

  test('calling create without params should throw invalid apiKey', async () => {
    await expect(() => {
      return create({});
    }).rejects.toThrowError('invalid apiKey');
  });

  test('calling create without baseURL should throw invalid baseURL', async () => {
    await expect(() => {
      return create({ 'openai.factory.apiKey': 'dummyKey' });
    }).rejects.toThrowError('invalid baseURL');
  });

  test('calling create with proper params should save connection as JSON', async () => {
    await create({
      'openai.factory.apiKey': 'dummyKey',
      'openai.factory.baseURL': 'http://localhost:11434/v1',
    });

    expect(SECRET_STORAGE_MOCK.store).toHaveBeenCalledOnce();
    const expected: StoredConnection[] = [
      { id: 'fake-uuid-1', apiKey: 'dummyKey', baseURL: 'http://localhost:11434/v1' },
    ];
    expect(SECRET_STORAGE_MOCK.store).toHaveBeenCalledWith(TOKENS_KEY, JSON.stringify(expected));
  });

  test('calling create should fetch models, create SDK and register inference connection', async () => {
    await create({
      'openai.factory.apiKey': 'dummyKey',
      'openai.factory.baseURL': 'http://localhost:11434/v1',
    });

    // listModels should fetch from baseURL
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:11434/v1/models', {
      headers: { Authorization: 'Bearer dummyKey' },
    });

    // ensure the SDK is created with proper params
    expect(createOpenAICompatible).toHaveBeenCalledOnce();
    expect(createOpenAICompatible).toHaveBeenCalledWith({
      baseURL: 'http://localhost:11434/v1',
      apiKey: 'dummyKey',
      name: 'http://localhost:11434/v1',
    });

    // ensure the connection has been registered with models and credentials
    expect(PROVIDER_MOCK.registerInferenceProviderConnection).toHaveBeenCalledOnce();
    const call = vi.mocked(PROVIDER_MOCK.registerInferenceProviderConnection).mock.calls[0][0];
    expect(call.name).toBe('http://localhost:11434/v1');
    expect(call.type).toBe('cloud');
    expect(call.llmMetadata).toEqual({ name: 'openai' });
    expect(call.endpoint).toBe('http://localhost:11434/v1');
    expect(call.sdk).toBe(OPENAI_PROVIDER_MOCK);
    expect(call.status).toEqual(expect.any(Function));
    expect(call.lifecycle).toEqual({ delete: expect.any(Function) });
    expect(call.models).toEqual([{ label: 'gpt-4o' }, { label: 'gpt-4.1' }]);
    expect(call.credentials()).toEqual({ 'openai:tokens': 'dummyKey' });
  });
});

describe('connection delete lifecycle', () => {
  let openai: OpenAI;
  let mDelete: (logger?: Logger) => Promise<void>;
  const disposeMock = vi.fn();

  beforeEach(async () => {
    vi.mocked(PROVIDER_MOCK.registerInferenceProviderConnection).mockReturnValue({
      dispose: disposeMock,
    });

    openai = new OpenAI(PROVIDER_API_MOCK, SECRET_STORAGE_MOCK);
    await openai.init();

    // Get the create factory
    const mock = vi.mocked(PROVIDER_MOCK.setInferenceProviderConnectionFactory);
    const create = mock.mock.calls[0][0].create;

    await create({
      'openai.factory.apiKey': 'dummyKey',
      'openai.factory.baseURL': 'http://localhost:11434/v1',
    });

    const registerMock = vi.mocked(PROVIDER_MOCK.registerInferenceProviderConnection);
    const lifecycle = registerMock.mock.calls[0][0].lifecycle;
    assert(lifecycle?.delete, 'delete method of lifecycle must be defined');

    mDelete = lifecycle.delete;
  });

  test('calling delete should update secrets and dispose provider inference connection', async () => {
    await mDelete();

    // secrets should have been updated at least twice (store on create, store on delete)
    expect(SECRET_STORAGE_MOCK.store).toHaveBeenCalledTimes(2);

    // provider inference connection should be disposed
    expect(disposeMock).toHaveBeenCalledOnce();
  });
});

describe('restoreConnections', () => {
  test('should restore multiple connections from JSON storage on init', async () => {
    const stored: StoredConnection[] = [
      { id: 'id-1', apiKey: 'key1', baseURL: 'http://a/v1' },
      { id: 'id-2', apiKey: 'key2', baseURL: 'http://b/v1' },
    ];
    vi.mocked(SECRET_STORAGE_MOCK.get).mockResolvedValue(JSON.stringify(stored));

    const openai = new OpenAI(PROVIDER_API_MOCK, SECRET_STORAGE_MOCK);
    await openai.init();

    expect(PROVIDER_MOCK.registerInferenceProviderConnection).toHaveBeenCalledTimes(2);
    expect(PROVIDER_MOCK.registerInferenceProviderConnection).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'id-1' }),
    );
    expect(PROVIDER_MOCK.registerInferenceProviderConnection).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'id-2' }),
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(1, 'http://a/v1/models', {
      headers: { Authorization: 'Bearer key1' },
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'http://b/v1/models', {
      headers: { Authorization: 'Bearer key2' },
    });
  });

  test('should restore connections even when one fails model listing', async () => {
    const stored: StoredConnection[] = [
      { id: 'id-1', apiKey: 'key1', baseURL: 'http://a/v1' },
      { id: 'id-2', apiKey: 'key2', baseURL: 'http://b/v1' },
    ];
    vi.mocked(SECRET_STORAGE_MOCK.get).mockResolvedValue(JSON.stringify(stored));
    fetchMock.mockResolvedValueOnce({ status: 500, json: async () => ({}) });

    const openai = new OpenAI(PROVIDER_API_MOCK, SECRET_STORAGE_MOCK);
    await openai.init();

    expect(PROVIDER_MOCK.registerInferenceProviderConnection).toHaveBeenCalledTimes(2);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(1, 'http://a/v1/models', {
      headers: { Authorization: 'Bearer key1' },
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'http://b/v1/models', {
      headers: { Authorization: 'Bearer key2' },
    });
  });

  test('should migrate legacy pipe+comma-separated format to JSON', async () => {
    vi.mocked(randomUUID)
      .mockReturnValueOnce('migrated-id-1' as ReturnType<typeof randomUUID>)
      .mockReturnValueOnce('migrated-id-2' as ReturnType<typeof randomUUID>);
    vi.mocked(SECRET_STORAGE_MOCK.get).mockResolvedValue('key1|http://a/v1,key2|http://b/v1');

    const openai = new OpenAI(PROVIDER_API_MOCK, SECRET_STORAGE_MOCK);
    await openai.init();

    const expected: StoredConnection[] = [
      { id: 'migrated-id-1', apiKey: 'key1', baseURL: 'http://a/v1' },
      { id: 'migrated-id-2', apiKey: 'key2', baseURL: 'http://b/v1' },
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
});

describe('listModels error handling (through factory)', () => {
  test('non-200 response should return undefined', async () => {
    const openai = new OpenAI(PROVIDER_API_MOCK, SECRET_STORAGE_MOCK);
    await openai.init();

    const mock = vi.mocked(PROVIDER_MOCK.setInferenceProviderConnectionFactory);
    const create = mock.mock.calls[0][0].create;

    fetchMock.mockResolvedValueOnce({ status: 500, json: async () => ({}) });

    await expect(create({ 'openai.factory.apiKey': 'k', 'openai.factory.baseURL': 'http://x/v1' })).resolves.toBe(
      undefined,
    );
  });

  test('missing data field should return undefined', async () => {
    const openai = new OpenAI(PROVIDER_API_MOCK, SECRET_STORAGE_MOCK);
    await openai.init();

    const mock = vi.mocked(PROVIDER_MOCK.setInferenceProviderConnectionFactory);
    const create = mock.mock.calls[0][0].create;

    fetchMock.mockResolvedValueOnce({ status: 200, json: async () => ({}) });

    await expect(create({ 'openai.factory.apiKey': 'k', 'openai.factory.baseURL': 'http://x/v1' })).resolves.toBe(
      undefined,
    );
  });

  test('data not array should return undefined', async () => {
    const openai = new OpenAI(PROVIDER_API_MOCK, SECRET_STORAGE_MOCK);
    await openai.init();

    const mock = vi.mocked(PROVIDER_MOCK.setInferenceProviderConnectionFactory);
    const create = mock.mock.calls[0][0].create;

    fetchMock.mockResolvedValueOnce({ status: 200, json: async () => ({ data: {} }) });

    await expect(create({ 'openai.factory.apiKey': 'k', 'openai.factory.baseURL': 'http://x/v1' })).resolves.toBe(
      undefined,
    );
  });
});

describe('duplicate connection prevention', () => {
  test('creating the same connection twice should throw', async () => {
    const openai = new OpenAI(PROVIDER_API_MOCK, SECRET_STORAGE_MOCK);
    await openai.init();

    const mock = vi.mocked(PROVIDER_MOCK.setInferenceProviderConnectionFactory);
    const create = mock.mock.calls[0][0].create;

    await create({ 'openai.factory.apiKey': 'dup', 'openai.factory.baseURL': 'http://dup/v1' });

    const stored: StoredConnection[] = [{ id: 'fake-uuid-1', apiKey: 'dup', baseURL: 'http://dup/v1' }];
    vi.mocked(SECRET_STORAGE_MOCK.get).mockResolvedValue(JSON.stringify(stored));

    await expect(
      create({ 'openai.factory.apiKey': 'dup', 'openai.factory.baseURL': 'http://dup/v1' }),
    ).rejects.toThrowError('connection already exists for baseURL http://dup/v1');
  });
});
