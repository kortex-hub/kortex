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

import { InferenceConnectionSummaryRegistry } from './inference-connection-summary-registry.js';
import type { ProviderRegistry } from './provider-registry.js';

let registry: InferenceConnectionSummaryRegistry;
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

  registry = new InferenceConnectionSummaryRegistry(providerRegistry, apiSender, ipcHandleMock);
});

test('init registers IPC handler for getInferenceConnectionSummaries', () => {
  registry.init();
  expect(ipcHandleMock).toHaveBeenCalledWith(
    'inference-connection-summary-registry:getInferenceConnectionSummaries',
    expect.any(Function),
  );
});

test('init subscribes to inference connection events', () => {
  registry.init();
  expect(onDidRegisterInferenceConnectionMock).toHaveBeenCalledWith(expect.any(Function));
  expect(onDidUnregisterInferenceConnectionMock).toHaveBeenCalledWith(expect.any(Function));
  expect(onDidUpdateProviderMock).toHaveBeenCalledWith(expect.any(Function));
});

test('init subscribes to provider-create, provider-delete, and provider-change events', () => {
  registry.init();
  expect(apiSenderReceiveMock).toHaveBeenCalledWith('provider-create', expect.any(Function));
  expect(apiSenderReceiveMock).toHaveBeenCalledWith('provider-delete', expect.any(Function));
  expect(apiSenderReceiveMock).toHaveBeenCalledWith('provider-change', expect.any(Function));
});

test('getInferenceConnectionSummaries returns empty array when no providers', () => {
  registry.init();
  const data = registry.getInferenceConnectionSummaries();
  expect(data).toEqual([]);
});

test('getInferenceConnectionSummaries builds summaries with active connections', () => {
  getProviderInfosMock.mockReturnValue([
    {
      id: 'openai',
      name: 'OpenAI',
      internalId: 'openai-1',
      inferenceConnections: [
        { name: 'conn1', type: 'cloud', status: 'started', models: [{ label: 'gpt-4' }] },
        { name: 'conn2', type: 'cloud', status: 'stopped', models: [{ label: 'gpt-3.5' }] },
      ],
      inferenceProviderConnectionCreation: true,
      inferenceProviderConnectionCreationDisplayName: 'OpenAI Setup',
      inferenceProviderConnectionCreationTypes: [],
    },
  ] as unknown as ProviderInfo[]);

  registry.init();
  const data = registry.getInferenceConnectionSummaries();

  expect(data).toHaveLength(1);
  expect(data[0]).toEqual({
    providerName: 'OpenAI',
    providerId: 'openai',
    providerInternalId: 'openai-1',
    connectionName: 'conn1',
    connectionType: 'cloud',
    status: 'started',
    modelCount: 2,
    creationDisplayName: 'OpenAI Setup',
    configurable: true,
  });
});

test('getInferenceConnectionSummaries includes not-configured entries for factory types without connections', () => {
  getProviderInfosMock.mockReturnValue([
    {
      id: 'multi',
      name: 'Multi Provider',
      internalId: 'multi-1',
      inferenceConnections: [{ name: 'cloud-conn', type: 'cloud', status: 'started', models: [{ label: 'model-a' }] }],
      inferenceProviderConnectionCreation: true,
      inferenceProviderConnectionCreationTypes: ['cloud', 'self-hosted', 'local'],
    },
  ] as unknown as ProviderInfo[]);

  registry.init();
  const data = registry.getInferenceConnectionSummaries();

  expect(data).toHaveLength(3);
  const notConfigured = data.filter(s => s.status === 'not-configured');
  expect(notConfigured).toHaveLength(2);
  expect(notConfigured.map(s => s.connectionType)).toEqual(expect.arrayContaining(['self-hosted', 'local']));
});

test('invalidate sends inference-connection-summary-registry:update event when data changes', () => {
  getProviderInfosMock.mockReturnValue([]);
  registry.init();

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

  expect(apiSenderSendMock).toHaveBeenCalledWith('inference-connection-summary-registry:update');
});

test('dispose cleans up subscriptions', () => {
  const disposeMocks = [vi.fn(), vi.fn(), vi.fn()];
  onDidRegisterInferenceConnectionMock.mockReturnValue({ dispose: disposeMocks[0] });
  onDidUnregisterInferenceConnectionMock.mockReturnValue({ dispose: disposeMocks[1] });
  onDidUpdateProviderMock.mockReturnValue({ dispose: disposeMocks[2] });

  registry.init();
  registry.dispose();

  for (const mock of disposeMocks) {
    expect(mock).toHaveBeenCalled();
  }
});
