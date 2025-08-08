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

import { createGoogleGenerativeAI, type GoogleGenerativeAIProvider } from '@ai-sdk/google';
import type {
  CancellationToken,
  Disposable,
  Logger,
  Provider,
  provider as ProviderAPI,
  SecretStorage,
} from '@kortex-app/api';
import { assert, beforeEach, describe, expect, test, vi } from 'vitest';

import { Gemini, TOKENS_KEY } from './gemini';

vi.mock('@kortex-app/api', () => ({
  Disposable: {
    create: (func: () => void): Disposable => {
      return {
        dispose: func,
      };
    },
    from: vi.fn(),
  },
}));

vi.mock(import('@ai-sdk/google'), () => ({
  createGoogleGenerativeAI: vi.fn(),
}));

const GOOGLE_AI_PROVIDER_MOCK: GoogleGenerativeAIProvider = {} as unknown as GoogleGenerativeAIProvider;

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

beforeEach(() => {
  vi.resetAllMocks();

  vi.mocked(PROVIDER_API_MOCK.createProvider).mockReturnValue(PROVIDER_MOCK as Provider);
  vi.mocked(createGoogleGenerativeAI).mockReturnValue(GOOGLE_AI_PROVIDER_MOCK);
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
    });
  });

  test('should register inference factory', async () => {
    const gemini = new Gemini(PROVIDER_API_MOCK, SAFE_STORAGE_MOCK);
    await gemini.init();

    expect(PROVIDER_MOCK.setInferenceProviderConnectionFactory).toHaveBeenCalledOnce();
    expect(PROVIDER_MOCK.setInferenceProviderConnectionFactory).toHaveBeenCalledWith({
      create: expect.any(Function),
    });
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

  test('calling create with proper params should save token', async () => {
    await create({
      'gemini.factory.apiKey': 'dummyKey',
    });

    // ensure store has been updated
    expect(SAFE_STORAGE_MOCK.store).toHaveBeenCalledOnce();
    expect(SAFE_STORAGE_MOCK.store).toHaveBeenCalledWith(TOKENS_KEY, 'dummyKey');
  });

  test('calling create with proper params should register inference connection', async () => {
    await create({
      'gemini.factory.apiKey': 'dummyKey',
    });

    // ensure the key is used to create a google client
    expect(createGoogleGenerativeAI).toHaveBeenCalledOnce();
    expect(createGoogleGenerativeAI).toHaveBeenCalledWith({
      apiKey: 'dummyKey',
    });

    // ensure the connection has been registered
    expect(PROVIDER_MOCK.registerInferenceProviderConnection).toHaveBeenCalledOnce();
    expect(PROVIDER_MOCK.registerInferenceProviderConnection).toHaveBeenCalledWith({
      name: 'dum*****',
      status: expect.any(Function),
      lifecycle: {
        delete: expect.any(Function),
      },
      sdk: GOOGLE_AI_PROVIDER_MOCK,
    });
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

  test('calling delete should delete the token', async () => {
    await mDelete();

    // should have been called twice
    expect(SAFE_STORAGE_MOCK.store).toHaveBeenCalledTimes(2);

    // first time when registering the connection
    expect(SAFE_STORAGE_MOCK.store).toHaveBeenNthCalledWith(1, TOKENS_KEY, 'dummyKey');

    // second time when unregistering the connection
    expect(SAFE_STORAGE_MOCK.store).toHaveBeenNthCalledWith(2, TOKENS_KEY, '');
  });

  test('calling delete should dispose provider inference connection', async () => {
    await mDelete();

    expect(disposeMock).toHaveBeenCalledOnce();
  });
});
