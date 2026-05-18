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

import { beforeEach, expect, test, vi } from 'vitest';

import type { ApiSenderType } from '/@api/api-sender/api-sender-type.js';
import type { ProviderInfo } from '/@api/provider-info.js';

import { ModelRegistry } from './model-registry.js';
import type { ProviderRegistry } from './provider-registry.js';

let modelRegistry: ModelRegistry;
const apiSenderSendMock = vi.fn();
const apiSenderReceiveMock = vi.fn().mockReturnValue({ dispose: vi.fn() });
const ipcHandleMock = vi.fn();
const getProviderInfosMock = vi.fn<() => ProviderInfo[]>();
const onDidRegisterInferenceConnectionMock = vi.fn().mockReturnValue({ dispose: vi.fn() });
const onDidUnregisterInferenceConnectionMock = vi.fn().mockReturnValue({ dispose: vi.fn() });
const onDidUpdateProviderMock = vi.fn().mockReturnValue({ dispose: vi.fn() });

beforeEach(() => {
  vi.resetAllMocks();

  apiSenderReceiveMock.mockReturnValue({ dispose: vi.fn() });
  onDidRegisterInferenceConnectionMock.mockReturnValue({ dispose: vi.fn() });
  onDidUnregisterInferenceConnectionMock.mockReturnValue({ dispose: vi.fn() });
  onDidUpdateProviderMock.mockReturnValue({ dispose: vi.fn() });

  getProviderInfosMock.mockReturnValue([]);

  const apiSender = {
    send: apiSenderSendMock,
    receive: apiSenderReceiveMock,
  } as unknown as ApiSenderType;

  const providerRegistry = {
    getProviderInfos: getProviderInfosMock,
    onDidRegisterInferenceConnection: onDidRegisterInferenceConnectionMock,
    onDidUnregisterInferenceConnection: onDidUnregisterInferenceConnectionMock,
    onDidUpdateProvider: onDidUpdateProviderMock,
  } as unknown as ProviderRegistry;

  modelRegistry = new ModelRegistry(providerRegistry, apiSender, ipcHandleMock);
});

test('init registers IPC handler for getCatalogModels', () => {
  modelRegistry.init();
  expect(ipcHandleMock).toHaveBeenCalledWith('model-registry:getCatalogModels', expect.any(Function));
});

test('init subscribes to inference connection events', () => {
  modelRegistry.init();
  expect(onDidRegisterInferenceConnectionMock).toHaveBeenCalledWith(expect.any(Function));
  expect(onDidUnregisterInferenceConnectionMock).toHaveBeenCalledWith(expect.any(Function));
  expect(onDidUpdateProviderMock).toHaveBeenCalledWith(expect.any(Function));
});

test('init subscribes to provider-create, provider-delete, and provider-change events', () => {
  modelRegistry.init();
  expect(apiSenderReceiveMock).toHaveBeenCalledWith('provider-create', expect.any(Function));
  expect(apiSenderReceiveMock).toHaveBeenCalledWith('provider-delete', expect.any(Function));
  expect(apiSenderReceiveMock).toHaveBeenCalledWith('provider-change', expect.any(Function));
});

test('getCatalogModels returns empty array when no providers', () => {
  modelRegistry.init();
  const data = modelRegistry.getCatalogModels();
  expect(data).toEqual([]);
});

test('getCatalogModels builds CatalogModelInfo from providers', () => {
  getProviderInfosMock.mockReturnValue([
    {
      id: 'anthropic',
      name: 'Anthropic',
      internalId: 'anthropic-1',
      inferenceConnections: [
        {
          name: 'default',
          type: 'cloud',
          status: 'started',
          llmMetadata: { name: 'claude' },
          endpoint: 'https://api.anthropic.com',
          models: [{ label: 'claude-3' }, { label: 'claude-4' }],
        },
      ],
      inferenceProviderConnectionCreation: false,
      inferenceProviderConnectionCreationTypes: [],
    },
  ] as unknown as ProviderInfo[]);

  modelRegistry.init();
  const data = modelRegistry.getCatalogModels();

  expect(data).toHaveLength(2);
  expect(data[0]).toEqual({
    providerId: 'anthropic',
    providerName: 'Anthropic',
    connectionName: 'default',
    type: 'cloud',
    llmMetadata: { name: 'claude' },
    endpoint: 'https://api.anthropic.com',
    label: 'claude-3',
    connectionStatus: 'started',
  });
  expect(data[1]).toEqual(expect.objectContaining({ label: 'claude-4' }));
});

test('invalidate sends model-registry:update event when data changes', () => {
  getProviderInfosMock.mockReturnValue([]);
  modelRegistry.init();

  getProviderInfosMock.mockReturnValue([
    {
      id: 'new-provider',
      name: 'New',
      internalId: 'new-1',
      inferenceConnections: [{ name: 'conn', type: 'cloud', status: 'started', models: [{ label: 'new-model' }] }],
      inferenceProviderConnectionCreation: false,
      inferenceProviderConnectionCreationTypes: [],
    },
  ] as unknown as ProviderInfo[]);

  const callback = onDidRegisterInferenceConnectionMock.mock.calls[0]?.[0] as () => void;
  callback();

  expect(apiSenderSendMock).toHaveBeenCalledWith('model-registry:update');
});

test('dispose cleans up subscriptions', () => {
  const disposeMocks = [vi.fn(), vi.fn(), vi.fn()];
  onDidRegisterInferenceConnectionMock.mockReturnValue({ dispose: disposeMocks[0] });
  onDidUnregisterInferenceConnectionMock.mockReturnValue({ dispose: disposeMocks[1] });
  onDidUpdateProviderMock.mockReturnValue({ dispose: disposeMocks[2] });

  modelRegistry.init();
  modelRegistry.dispose();

  for (const mock of disposeMocks) {
    expect(mock).toHaveBeenCalled();
  }
});
