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

import { createOpenAICompatible, type OpenAICompatibleProvider } from '@ai-sdk/openai-compatible';
import { KubeConfig } from '@kubernetes/client-node';
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

import { OpenShiftAI, PROVIDER_ID, type StoredConnection, TOKENS_KEY } from './openshiftai';

vi.mock(import('node:crypto'), async importOriginal => {
  const actual = await importOriginal();
  return {
    ...actual,
    randomUUID: vi.fn().mockReturnValue('fake-uuid-1'),
  };
});

const CONFIG_UPDATE_MOCK = vi.fn();

const CONFIGURATION_MOCK: Configuration = {
  get: vi.fn(),
  has: vi.fn(),
  update: CONFIG_UPDATE_MOCK,
} as unknown as Configuration;

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

vi.mock(import('@ai-sdk/openai-compatible'), () => ({
  createOpenAICompatible: vi.fn(),
}));

const listClusterCustomObjectMock = vi.fn();
const listNamespacedCustomObjectMock = vi.fn();
const listNamespacedSecretMock = vi.fn();

vi.mock(import('@kubernetes/client-node'));

const OPENAI_PROVIDER_MOCK: OpenAICompatibleProvider = {} as unknown as OpenAICompatibleProvider;

const PROVIDER_API_MOCK: typeof ProviderAPI = {
  createProvider: vi.fn(),
} as unknown as typeof ProviderAPI;

const PROVIDER_MOCK: Provider = {
  id: 'openshiftai',
  name: 'OpenShift AI',
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
  vi.mocked(configuration.getConfiguration).mockReturnValue(CONFIGURATION_MOCK);

  const coreAPI = {
    listClusterCustomObject: listClusterCustomObjectMock,
    listNamespacedSecret: listNamespacedSecretMock,
  };
  vi.mocked(KubeConfig.prototype.makeApiClient).mockReturnValueOnce(coreAPI);
  const genericAPI = {
    listNamespacedCustomObject: listNamespacedCustomObjectMock,
    listClusterCustomObject: listClusterCustomObjectMock,
  };
  vi.mocked(KubeConfig.prototype.makeApiClient).mockReturnValueOnce(genericAPI);
});

test('constructor should not do anything', async () => {
  const openshiftai = new OpenShiftAI(PROVIDER_API_MOCK, SECRET_STORAGE_MOCK);
  expect(openshiftai).instanceof(OpenShiftAI);

  expect(PROVIDER_API_MOCK.createProvider).not.toHaveBeenCalled();
});

describe('init', () => {
  test('should register provider', async () => {
    const openshiftai = new OpenShiftAI(PROVIDER_API_MOCK, SECRET_STORAGE_MOCK);
    await openshiftai.init();

    expect(PROVIDER_API_MOCK.createProvider).toHaveBeenCalledOnce();
    expect(PROVIDER_API_MOCK.createProvider).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'OpenShift AI',
        status: 'unknown',
        id: 'openshiftai',
      }),
    );
  });

  test('should register inference factory', async () => {
    const openshiftai = new OpenShiftAI(PROVIDER_API_MOCK, SECRET_STORAGE_MOCK);
    await openshiftai.init();

    expect(PROVIDER_MOCK.setInferenceProviderConnectionFactory).toHaveBeenCalledOnce();
    expect(PROVIDER_MOCK.setInferenceProviderConnectionFactory).toHaveBeenCalledWith({
      connectionTypes: ['self-hosted'],
      create: expect.any(Function),
    });
  });

  test('should not restore any connection if no secrets', async () => {
    const openshiftai = new OpenShiftAI(PROVIDER_API_MOCK, SECRET_STORAGE_MOCK);
    await openshiftai.init();

    expect(PROVIDER_MOCK.registerInferenceProviderConnection).not.toHaveBeenCalled();
  });
});

describe('factory', () => {
  let create: (params: { [key: string]: unknown }, logger?: Logger, token?: CancellationToken) => Promise<void>;
  beforeEach(async () => {
    const openshiftai = new OpenShiftAI(PROVIDER_API_MOCK, SECRET_STORAGE_MOCK);
    await openshiftai.init();

    const mock = vi.mocked(PROVIDER_MOCK.setInferenceProviderConnectionFactory);
    assert(mock, 'setInferenceProviderConnectionFactory must be defined');
    create = mock.mock.calls[0][0].create;
  });

  test('calling create without params should throw invalid OpenShift AI URL', async () => {
    await expect(() => {
      return create({});
    }).rejects.toThrowError('invalid OpenShift AI URL');
  });

  test('calling create without token should throw invalid token', async () => {
    await expect(() => {
      return create({ 'openshiftai.factory.url': 'https://api.cluster.example.com:6443' });
    }).rejects.toThrowError('invalid token');
  });

  test('calling create with no inference services found should throw', async () => {
    listClusterCustomObjectMock.mockResolvedValue({
      items: [{ metadata: { name: 'test-project' } }],
    });
    listNamespacedCustomObjectMock.mockResolvedValue({
      items: [],
    });

    await expect(() => {
      return create({
        'openshiftai.factory.url': 'https://api.cluster.example.com:6443',
        'openshiftai.factory.token': 'dummyToken',
      });
    }).rejects.toThrowError('no inference services found on the cluster');
  });

  test('calling create with no projects should throw no inference services', async () => {
    listClusterCustomObjectMock.mockResolvedValue({
      items: [],
    });

    await expect(() => {
      return create({
        'openshiftai.factory.url': 'https://api.cluster.example.com:6443',
        'openshiftai.factory.token': 'dummyToken',
      });
    }).rejects.toThrowError('no inference services found on the cluster');
  });

  test('calling create with valid inference services should register connection', async () => {
    listClusterCustomObjectMock.mockResolvedValue({
      items: [{ metadata: { name: 'test-project' } }],
    });
    listNamespacedCustomObjectMock.mockResolvedValue({
      items: [
        {
          metadata: { name: 'my-model' },
          spec: { predictor: { model: { runtime: 'vllm' } } },
          status: { url: 'https://my-model.example.com' },
        },
      ],
    });
    listNamespacedSecretMock.mockResolvedValue({
      items: [
        {
          metadata: { annotations: { 'kubernetes.io/service-account.name': 'vllm-sa' } },
          data: { token: Buffer.from('serviceToken').toString('base64') },
        },
      ],
    });

    fetchMock.mockResolvedValue({
      status: 200,
      json: async () => ({ data: [{ id: 'llama-3' }] }),
    });

    await create({
      'openshiftai.factory.url': 'https://api.cluster.example.com:6443',
      'openshiftai.factory.token': 'dummyToken',
    });

    expect(PROVIDER_MOCK.registerInferenceProviderConnection).toHaveBeenCalledOnce();
    const call = vi.mocked(PROVIDER_MOCK.registerInferenceProviderConnection).mock.calls[0][0];
    expect(call.id).toBe('fake-uuid-1');
    expect(call.name).toBe('https://api.cluster.example.com:6443');
    expect(call.type).toBe('self-hosted');
    expect(call.endpoint).toBe('https://my-model.example.com/v1');
    expect(call.sdk).toBe(OPENAI_PROVIDER_MOCK);
    expect(call.models).toEqual([{ label: 'llama-3' }]);

    const expected: StoredConnection[] = [
      {
        id: 'fake-uuid-1',
        url: 'https://api.cluster.example.com:6443',
        token: 'dummyToken',
        baseURL: 'https://my-model.example.com/v1',
      },
    ];
    expect(SECRET_STORAGE_MOCK.store).toHaveBeenCalledWith(TOKENS_KEY, JSON.stringify(expected));
  });

  test('should rollback saved config if registration fails', async () => {
    listClusterCustomObjectMock.mockResolvedValue({
      items: [{ metadata: { name: 'test-project' } }],
    });
    listNamespacedCustomObjectMock.mockResolvedValue({
      items: [
        {
          metadata: { name: 'my-model' },
          spec: { predictor: { model: { runtime: 'vllm' } } },
          status: { url: 'https://my-model.example.com' },
        },
      ],
    });
    listNamespacedSecretMock.mockResolvedValue({
      items: [
        {
          metadata: { annotations: { 'kubernetes.io/service-account.name': 'vllm-sa' } },
          data: { token: Buffer.from('serviceToken').toString('base64') },
        },
      ],
    });

    fetchMock.mockResolvedValue({
      status: 200,
      json: async () => ({ data: [{ id: 'llama-3' }] }),
    });

    vi.mocked(PROVIDER_MOCK.registerInferenceProviderConnection).mockImplementation(() => {
      throw new Error('registration boom');
    });

    await expect(
      create({
        'openshiftai.factory.url': 'https://api.cluster.example.com:6443',
        'openshiftai.factory.token': 'dummyToken',
      }),
    ).rejects.toThrow('registration boom');

    expect(SECRET_STORAGE_MOCK.delete).toHaveBeenCalledWith('openshiftai:fake-uuid-1:token');
    expect(CONFIG_UPDATE_MOCK).toHaveBeenCalledWith('openshiftai.connection._type', undefined);
    expect(CONFIG_UPDATE_MOCK).toHaveBeenCalledWith('openshiftai.connection.token', undefined);
  });
});

describe('restoreConnections', () => {
  test('should not crash if restore fails due to no inference services', async () => {
    const stored: StoredConnection[] = [
      {
        id: 'persisted-id',
        url: 'https://api.cluster.example.com:6443',
        token: 'savedToken',
        baseURL: 'https://my-model.example.com/v1',
      },
    ];
    vi.mocked(SECRET_STORAGE_MOCK.get).mockResolvedValue(JSON.stringify(stored));

    listClusterCustomObjectMock.mockResolvedValue({ items: [] });

    const openshiftai = new OpenShiftAI(PROVIDER_API_MOCK, SECRET_STORAGE_MOCK);
    await openshiftai.init();

    expect(PROVIDER_MOCK.registerInferenceProviderConnection).not.toHaveBeenCalled();
  });

  test('should migrate legacy pipe/comma-separated format by discovering services', async () => {
    vi.mocked(randomUUID).mockReturnValue('migrated-id-1' as ReturnType<typeof randomUUID>);
    vi.mocked(SECRET_STORAGE_MOCK.get).mockResolvedValue('tokenA|https://cluster-a.com:6443');

    const coreAPI = {
      listClusterCustomObject: listClusterCustomObjectMock,
      listNamespacedSecret: listNamespacedSecretMock,
    };
    const genericAPI = {
      listNamespacedCustomObject: listNamespacedCustomObjectMock,
      listClusterCustomObject: listClusterCustomObjectMock,
    };
    vi.mocked(KubeConfig.prototype.makeApiClient)
      .mockReturnValueOnce(coreAPI)
      .mockReturnValueOnce(genericAPI)
      .mockReturnValueOnce(coreAPI)
      .mockReturnValueOnce(genericAPI);

    listClusterCustomObjectMock.mockResolvedValue({
      items: [{ metadata: { name: 'test-project' } }],
    });
    listNamespacedCustomObjectMock.mockResolvedValue({
      items: [
        {
          metadata: { name: 'my-model' },
          spec: { predictor: { model: { runtime: 'vllm' } } },
          status: { url: 'https://my-model.example.com' },
        },
      ],
    });
    listNamespacedSecretMock.mockResolvedValue({
      items: [
        {
          metadata: { annotations: { 'kubernetes.io/service-account.name': 'vllm-sa' } },
          data: { token: Buffer.from('serviceToken').toString('base64') },
        },
      ],
    });
    fetchMock.mockResolvedValue({
      status: 200,
      json: async () => ({ data: [{ id: 'llama-3' }] }),
    });

    const openshiftai = new OpenShiftAI(PROVIDER_API_MOCK, SECRET_STORAGE_MOCK);
    await openshiftai.init();

    const expected: StoredConnection[] = [
      {
        id: 'migrated-id-1',
        url: 'https://cluster-a.com:6443',
        token: 'tokenA',
        baseURL: 'https://my-model.example.com/v1',
      },
    ];
    expect(SECRET_STORAGE_MOCK.store).toHaveBeenCalledWith(TOKENS_KEY, JSON.stringify(expected));
    expect(PROVIDER_MOCK.registerInferenceProviderConnection).toHaveBeenCalledOnce();
  });

  test('should restore persisted IDs across restarts', async () => {
    const stored: StoredConnection[] = [
      {
        id: 'stable-id-1',
        url: 'https://cluster1.example.com:6443',
        token: 'key1',
        baseURL: 'https://my-model.example.com/v1',
      },
    ];
    vi.mocked(SECRET_STORAGE_MOCK.get).mockResolvedValue(JSON.stringify(stored));

    listClusterCustomObjectMock.mockResolvedValue({
      items: [{ metadata: { name: 'test-project' } }],
    });
    listNamespacedCustomObjectMock.mockResolvedValue({
      items: [
        {
          metadata: { name: 'my-model' },
          spec: { predictor: { model: { runtime: 'vllm' } } },
          status: { url: 'https://my-model.example.com' },
        },
      ],
    });
    listNamespacedSecretMock.mockResolvedValue({
      items: [
        {
          metadata: { annotations: { 'kubernetes.io/service-account.name': 'vllm-sa' } },
          data: { token: Buffer.from('serviceToken').toString('base64') },
        },
      ],
    });
    fetchMock.mockResolvedValue({
      status: 200,
      json: async () => ({ data: [{ id: 'llama-3' }] }),
    });

    const openshiftai = new OpenShiftAI(PROVIDER_API_MOCK, SECRET_STORAGE_MOCK);
    await openshiftai.init();

    expect(PROVIDER_MOCK.registerInferenceProviderConnection).toHaveBeenCalledOnce();
    expect(PROVIDER_MOCK.registerInferenceProviderConnection).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'stable-id-1', name: 'https://cluster1.example.com:6443' }),
    );
  });
});

describe('workspace configuration', () => {
  beforeEach(() => {
    vi.mocked(PROVIDER_MOCK.registerInferenceProviderConnection).mockReturnValue({
      dispose: vi.fn(),
    });
  });

  test('should store per-connection secret and set configuration after registration', async () => {
    listClusterCustomObjectMock.mockResolvedValue({
      items: [{ metadata: { name: 'test-project' } }],
    });
    listNamespacedCustomObjectMock.mockResolvedValue({
      items: [
        {
          metadata: { name: 'my-model' },
          spec: { predictor: { model: { runtime: 'vllm' } } },
          status: { url: 'https://my-model.example.com' },
        },
      ],
    });
    listNamespacedSecretMock.mockResolvedValue({
      items: [
        {
          metadata: { annotations: { 'kubernetes.io/service-account.name': 'vllm-sa' } },
          data: { token: Buffer.from('serviceToken').toString('base64') },
        },
      ],
    });
    fetchMock.mockResolvedValue({
      status: 200,
      json: async () => ({ data: [{ id: 'llama-3' }] }),
    });

    const openshiftai = new OpenShiftAI(PROVIDER_API_MOCK, SECRET_STORAGE_MOCK);
    await openshiftai.init();

    const mock = vi.mocked(PROVIDER_MOCK.setInferenceProviderConnectionFactory);
    const create = mock.mock.calls[0][0].create;

    await create({
      'openshiftai.factory.url': 'https://api.cluster.example.com:6443',
      'openshiftai.factory.token': 'dummyToken',
    });

    expect(SECRET_STORAGE_MOCK.store).toHaveBeenCalledWith(`${PROVIDER_ID}:fake-uuid-1:token`, 'dummyToken');

    const connection = vi.mocked(PROVIDER_MOCK.registerInferenceProviderConnection).mock.calls[0][0];
    expect(configuration.getConfiguration).toHaveBeenCalledWith(undefined, connection);

    expect(CONFIG_UPDATE_MOCK).toHaveBeenCalledWith('openshiftai.connection._type', PROVIDER_ID);
    expect(CONFIG_UPDATE_MOCK).toHaveBeenCalledWith('openshiftai.connection.token', `${PROVIDER_ID}:fake-uuid-1:token`);
  });

  test('should set workspace configuration for each restored connection', async () => {
    const stored: StoredConnection[] = [
      {
        id: 'id-1',
        url: 'https://cluster1.example.com:6443',
        token: 'key1',
        baseURL: 'https://model1.example.com/v1',
      },
      {
        id: 'id-2',
        url: 'https://cluster2.example.com:6443',
        token: 'key2',
        baseURL: 'https://model2.example.com/v1',
      },
    ];
    vi.mocked(SECRET_STORAGE_MOCK.get).mockResolvedValue(JSON.stringify(stored));

    const coreAPI = {
      listClusterCustomObject: listClusterCustomObjectMock,
      listNamespacedSecret: listNamespacedSecretMock,
    };
    const genericAPI = {
      listNamespacedCustomObject: listNamespacedCustomObjectMock,
      listClusterCustomObject: listClusterCustomObjectMock,
    };
    vi.mocked(KubeConfig.prototype.makeApiClient)
      .mockReturnValueOnce(coreAPI)
      .mockReturnValueOnce(genericAPI)
      .mockReturnValueOnce(coreAPI)
      .mockReturnValueOnce(genericAPI)
      .mockReturnValueOnce(coreAPI)
      .mockReturnValueOnce(genericAPI);

    listClusterCustomObjectMock.mockResolvedValue({
      items: [{ metadata: { name: 'test-project' } }],
    });
    listNamespacedSecretMock.mockResolvedValue({
      items: [
        {
          metadata: { annotations: { 'kubernetes.io/service-account.name': 'vllm-sa' } },
          data: { token: Buffer.from('serviceToken').toString('base64') },
        },
      ],
    });

    // Mock for first connection
    listNamespacedCustomObjectMock.mockResolvedValueOnce({
      items: [
        {
          metadata: { name: 'model1' },
          spec: { predictor: { model: { runtime: 'vllm' } } },
          status: { url: 'https://model1.example.com' },
        },
      ],
    });

    // Mock for second connection
    listNamespacedCustomObjectMock.mockResolvedValueOnce({
      items: [
        {
          metadata: { name: 'model2' },
          spec: { predictor: { model: { runtime: 'vllm' } } },
          status: { url: 'https://model2.example.com' },
        },
      ],
    });

    fetchMock.mockResolvedValue({
      status: 200,
      json: async () => ({ data: [{ id: 'llama-3' }] }),
    });

    const openshiftai = new OpenShiftAI(PROVIDER_API_MOCK, SECRET_STORAGE_MOCK);
    await openshiftai.init();

    expect(SECRET_STORAGE_MOCK.store).toHaveBeenCalledWith(`${PROVIDER_ID}:id-1:token`, 'key1');
    expect(SECRET_STORAGE_MOCK.store).toHaveBeenCalledWith(`${PROVIDER_ID}:id-2:token`, 'key2');

    expect(CONFIG_UPDATE_MOCK).toHaveBeenCalledWith('openshiftai.connection._type', PROVIDER_ID);
    expect(CONFIG_UPDATE_MOCK).toHaveBeenCalledWith('openshiftai.connection.token', `${PROVIDER_ID}:id-1:token`);
    expect(CONFIG_UPDATE_MOCK).toHaveBeenCalledWith('openshiftai.connection.token', `${PROVIDER_ID}:id-2:token`);
  });
});

describe('connection delete lifecycle', () => {
  let mDelete: (logger?: Logger) => Promise<void>;
  const disposeMock = vi.fn();

  beforeEach(async () => {
    vi.mocked(PROVIDER_MOCK.registerInferenceProviderConnection).mockReturnValue({
      dispose: disposeMock,
    });

    listClusterCustomObjectMock.mockResolvedValue({
      items: [{ metadata: { name: 'test-project' } }],
    });
    listNamespacedCustomObjectMock.mockResolvedValue({
      items: [
        {
          metadata: { name: 'my-model' },
          spec: { predictor: { model: { runtime: 'vllm' } } },
          status: { url: 'https://my-model.example.com' },
        },
      ],
    });
    listNamespacedSecretMock.mockResolvedValue({
      items: [
        {
          metadata: { annotations: { 'kubernetes.io/service-account.name': 'vllm-sa' } },
          data: { token: Buffer.from('serviceToken').toString('base64') },
        },
      ],
    });
    fetchMock.mockResolvedValue({
      status: 200,
      json: async () => ({ data: [{ id: 'llama-3' }] }),
    });

    const openshiftai = new OpenShiftAI(PROVIDER_API_MOCK, SECRET_STORAGE_MOCK);
    await openshiftai.init();

    const mock = vi.mocked(PROVIDER_MOCK.setInferenceProviderConnectionFactory);
    const create = mock.mock.calls[0][0].create;

    await create({
      'openshiftai.factory.url': 'https://api.cluster.example.com:6443',
      'openshiftai.factory.token': 'dummyToken',
    });

    const lifecycle = vi.mocked(PROVIDER_MOCK.registerInferenceProviderConnection).mock.calls[0][0].lifecycle;
    assert(lifecycle?.delete, 'lifecycle.delete must be defined');
    mDelete = lifecycle.delete;
  });

  test('calling delete should remove the connection from storage, clear configuration, and dispose', async () => {
    await mDelete();

    expect(SECRET_STORAGE_MOCK.delete).toHaveBeenCalledWith(`${PROVIDER_ID}:fake-uuid-1:token`);

    expect(CONFIG_UPDATE_MOCK).toHaveBeenCalledWith('openshiftai.connection._type', undefined);
    expect(CONFIG_UPDATE_MOCK).toHaveBeenCalledWith('openshiftai.connection.token', undefined);

    expect(disposeMock).toHaveBeenCalledOnce();
  });
});
