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

import { type AnthropicProvider, createAnthropic } from '@ai-sdk/anthropic';
import AnthropicClient from '@anthropic-ai/sdk';
import type { ModelInfo } from '@anthropic-ai/sdk/client';
import type {
  CancellationToken,
  Disposable,
  Logger,
  Provider,
  provider as ProviderAPI,
  SecretStorage,
} from '@openkaiden/api';
import { assert, beforeEach, describe, expect, test, vi } from 'vitest';

import { Anthropic, TOKENS_KEY } from './anthropic';

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

vi.mock(import('@ai-sdk/anthropic'), () => ({
  createAnthropic: vi.fn(),
}));

vi.mock(import('@anthropic-ai/sdk'));

const ANTHROPIC_PROVIDER_MOCK: AnthropicProvider = {} as unknown as AnthropicProvider;

const PROVIDER_API_MOCK: typeof ProviderAPI = {
  createProvider: vi.fn(),
} as unknown as typeof ProviderAPI;

const PROVIDER_MOCK: Provider = {
  id: 'anthropic',
  name: 'Anthropic',
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
  vi.mocked(createAnthropic).mockReturnValue(ANTHROPIC_PROVIDER_MOCK);

  // Mock AnthropicClient prototype models.list to return async iterable
  const mockModels = [
    {
      id: 'claude-sonnet-4-20250514',
      display_name: 'Claude Sonnet 4',
      created_at: '2025-05-14T00:00:00Z',
      type: 'model',
    },
    {
      id: 'claude-haiku-3.5-20241022',
      display_name: 'Claude 3.5 Haiku',
      created_at: '2024-10-22T00:00:00Z',
      type: 'model',
    },
  ];

  // Create async iterable mock
  const mockPage = {
    async *[Symbol.asyncIterator](): AsyncGenerator<ModelInfo> {
      for (const model of mockModels) {
        yield model;
      }
    },
  };

  const mockList = vi.fn().mockReturnValue(mockPage);
  (vi.mocked(AnthropicClient.prototype) as unknown as { models: { list: typeof mockList } }).models = {
    list: mockList,
  };
});

test('constructor should not do anything', async () => {
  const anthropic = new Anthropic(PROVIDER_API_MOCK, SAFE_STORAGE_MOCK);
  expect(anthropic).instanceof(Anthropic);

  expect(PROVIDER_API_MOCK.createProvider).not.toHaveBeenCalled();
});

describe('init', () => {
  test('should register provider', async () => {
    const anthropic = new Anthropic(PROVIDER_API_MOCK, SAFE_STORAGE_MOCK);
    await anthropic.init();

    expect(PROVIDER_API_MOCK.createProvider).toHaveBeenCalledOnce();
    expect(PROVIDER_API_MOCK.createProvider).toHaveBeenCalledWith({
      name: 'Anthropic',
      status: 'unknown',
      id: 'anthropic',
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
    const anthropic = new Anthropic(PROVIDER_API_MOCK, SAFE_STORAGE_MOCK);
    await anthropic.init();

    expect(PROVIDER_MOCK.setInferenceProviderConnectionFactory).toHaveBeenCalledOnce();
    expect(PROVIDER_MOCK.setInferenceProviderConnectionFactory).toHaveBeenCalledWith({
      create: expect.any(Function),
    });
  });
});

describe('factory', () => {
  let create: (params: { [key: string]: unknown }, logger?: Logger, token?: CancellationToken) => Promise<void>;
  beforeEach(async () => {
    const anthropic = new Anthropic(PROVIDER_API_MOCK, SAFE_STORAGE_MOCK);
    await anthropic.init();

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
      'anthropic.factory.apiKey': 'dummyKey',
    });

    // ensure store has been updated
    expect(SAFE_STORAGE_MOCK.store).toHaveBeenCalledOnce();
    expect(SAFE_STORAGE_MOCK.store).toHaveBeenCalledWith(TOKENS_KEY, 'dummyKey');
  });

  test('calling create with proper params should register inference connection', async () => {
    await create({
      'anthropic.factory.apiKey': 'dummyKey',
    });

    // ensure the key is used to create an anthropic client
    expect(createAnthropic).toHaveBeenCalledOnce();
    expect(createAnthropic).toHaveBeenCalledWith({
      apiKey: 'dummyKey',
    });

    // ensure AnthropicClient was created for fetching models
    expect(AnthropicClient).toHaveBeenCalledWith({
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
      sdk: ANTHROPIC_PROVIDER_MOCK,
      models: [{ label: 'claude-sonnet-4-20250514' }, { label: 'claude-haiku-3.5-20241022' }],
      credentials: expect.any(Function),
    });
  });
});

describe('connection delete lifecycle', () => {
  let anthropic: Anthropic;
  let mDelete: (logger?: Logger) => Promise<void>;
  const disposeMock = vi.fn();

  beforeEach(async () => {
    vi.mocked(PROVIDER_MOCK.registerInferenceProviderConnection).mockReturnValue({
      dispose: disposeMock,
    });

    anthropic = new Anthropic(PROVIDER_API_MOCK, SAFE_STORAGE_MOCK);
    await anthropic.init();

    // Get the create factory
    const mock = vi.mocked(PROVIDER_MOCK.setInferenceProviderConnectionFactory);
    const create = mock.mock.calls[0][0].create;

    await create({
      'anthropic.factory.apiKey': 'dummyKey',
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
