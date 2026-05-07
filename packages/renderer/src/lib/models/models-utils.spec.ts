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

import { expect, test } from 'vitest';

import type { ProviderInfo } from '/@api/provider-info';

import {
  getCatalogModels,
  getCloudCatalogModels,
  getCloudConnectionSummaries,
  getInferenceConnectionSummaries,
  getInHouseCatalogModels,
  getInHouseConnectionSummaries,
  getModels,
} from './models-utils';

test('getModels returns empty array for providers without inference connections', () => {
  const provider = { inferenceConnections: [] } as unknown as ProviderInfo;
  expect(getModels([provider])).toEqual([]);
});

test('getModels extracts models from inference connections', () => {
  const provider = {
    id: 'openai',
    inferenceConnections: [
      { name: 'default', type: 'cloud', status: 'started', models: [{ label: 'gpt-4' }, { label: 'gpt-3.5' }] },
    ],
  } as unknown as ProviderInfo;

  const result = getModels([provider]);
  expect(result).toHaveLength(2);
  expect(result[0]).toEqual({ providerId: 'openai', connectionName: 'default', type: 'cloud', label: 'gpt-4' });
});

test('getCatalogModels includes connectionStatus and providerName', () => {
  const provider = {
    id: 'anthropic',
    name: 'Anthropic',
    inferenceConnections: [
      { name: 'my-connection', type: 'cloud', status: 'started', models: [{ label: 'claude-3' }] },
    ],
  } as unknown as ProviderInfo;

  const result = getCatalogModels([provider]);
  expect(result).toHaveLength(1);
  expect(result[0]).toEqual({
    providerId: 'anthropic',
    providerName: 'Anthropic',
    connectionName: 'my-connection',
    type: 'cloud',
    label: 'claude-3',
    connectionStatus: 'started',
  });
});

test('getCatalogModels includes endpoint when connection provides one', () => {
  const provider = {
    id: 'openai-compatible',
    name: 'OpenAI Compatible',
    inferenceConnections: [
      {
        name: 'https://my-custom-api.example.com/v1',
        type: 'cloud',
        status: 'started',
        endpoint: 'https://my-custom-api.example.com/v1',
        models: [{ label: 'gpt-4o' }],
      },
    ],
  } as unknown as ProviderInfo;

  const result = getCatalogModels([provider]);
  expect(result).toHaveLength(1);
  expect(result[0]).toEqual({
    providerId: 'openai-compatible',
    providerName: 'OpenAI Compatible',
    connectionName: 'https://my-custom-api.example.com/v1',
    type: 'cloud',
    endpoint: 'https://my-custom-api.example.com/v1',
    label: 'gpt-4o',
    connectionStatus: 'started',
  });
});

test('getCatalogModels returns empty array when no providers', () => {
  expect(getCatalogModels([])).toEqual([]);
});

test('getCatalogModels handles connections with no models', () => {
  const provider = {
    inferenceConnections: [{ name: 'empty', type: 'cloud', status: 'stopped', models: [] }],
  } as unknown as ProviderInfo;

  expect(getCatalogModels([provider])).toEqual([]);
});

test('getInferenceConnectionSummaries returns one summary per provider with aggregated model count', () => {
  const provider = {
    id: 'openai',
    name: 'OpenAI',
    internalId: 'internal-1',
    inferenceConnections: [
      { name: 'conn-1', type: 'cloud', status: 'started', models: [{ label: 'gpt-4' }, { label: 'gpt-3.5' }] },
      { name: 'conn-2', type: 'self-hosted', status: 'stopped', models: [{ label: 'custom-model' }] },
    ],
  } as unknown as ProviderInfo;

  const result = getInferenceConnectionSummaries([provider]);
  expect(result).toHaveLength(1);
  expect(result[0]).toEqual({
    providerName: 'OpenAI',
    providerId: 'openai',
    providerInternalId: 'internal-1',
    connectionName: 'conn-1',
    connectionType: 'cloud',
    status: 'started',
    modelCount: 3,
    creationDisplayName: 'OpenAI',
  });
});

test('getInferenceConnectionSummaries returns empty for no providers', () => {
  expect(getInferenceConnectionSummaries([])).toEqual([]);
});

test('getInferenceConnectionSummaries skips providers without inference connections', () => {
  const provider = { inferenceConnections: [] } as unknown as ProviderInfo;
  expect(getInferenceConnectionSummaries([provider])).toEqual([]);
});

test('getInferenceConnectionSummaries emits not-configured entry when creation is supported but no connections exist', () => {
  const provider = {
    id: 'openai',
    name: 'OpenAI',
    internalId: 'internal-1',
    inferenceConnections: [],
    inferenceProviderConnectionCreation: true,
    inferenceProviderConnectionCreationDisplayName: 'OpenAI (Hosted)',
    inferenceProviderConnectionCreationTypes: ['cloud'],
  } as unknown as ProviderInfo;

  const result = getInferenceConnectionSummaries([provider]);
  expect(result).toHaveLength(1);
  expect(result[0]).toEqual({
    providerName: 'OpenAI',
    providerId: 'openai',
    providerInternalId: 'internal-1',
    connectionName: '',
    status: 'not-configured',
    modelCount: 0,
    creationDisplayName: 'OpenAI (Hosted)',
    connectionType: 'cloud',
  });
});

test('getCloudConnectionSummaries includes not-configured entries with cloud factory type', () => {
  const providers = [
    {
      id: 'claude',
      name: 'Claude',
      internalId: 'claude-internal',
      inferenceConnections: [],
      inferenceProviderConnectionCreation: true,
      inferenceProviderConnectionCreationTypes: ['cloud'],
    },
    {
      id: 'gemini',
      name: 'Gemini',
      internalId: 'gemini-internal',
      inferenceConnections: [{ name: 'default', type: 'cloud', status: 'started', models: [{ label: 'gemini-pro' }] }],
    },
  ] as unknown as ProviderInfo[];

  const result = getCloudConnectionSummaries(providers);
  expect(result).toHaveLength(2);
  expect(result.map(c => c.providerId)).toEqual(['claude', 'gemini']);
});

test('getCloudConnectionSummaries excludes not-configured entries with self-hosted factory type', () => {
  const providers = [
    {
      id: 'openshift-ai',
      name: 'OpenShift AI',
      internalId: 'oai-internal',
      inferenceConnections: [],
      inferenceProviderConnectionCreation: true,
      inferenceProviderConnectionCreationTypes: ['self-hosted'],
    },
    {
      id: 'gemini',
      name: 'Gemini',
      internalId: 'gemini-internal',
      inferenceConnections: [{ name: 'default', type: 'cloud', status: 'started', models: [{ label: 'gemini-pro' }] }],
    },
  ] as unknown as ProviderInfo[];

  const result = getCloudConnectionSummaries(providers);
  expect(result).toHaveLength(1);
  expect(result[0].providerId).toBe('gemini');
});

test('getInHouseConnectionSummaries includes not-configured entries with self-hosted factory type', () => {
  const providers = [
    {
      id: 'openshift-ai',
      name: 'OpenShift AI',
      internalId: 'oai-internal',
      inferenceConnections: [],
      inferenceProviderConnectionCreation: true,
      inferenceProviderConnectionCreationTypes: ['self-hosted'],
    },
  ] as unknown as ProviderInfo[];

  const result = getInHouseConnectionSummaries(providers);
  expect(result).toHaveLength(1);
  expect(result[0]).toMatchObject({
    providerId: 'openshift-ai',
    connectionType: 'self-hosted',
    status: 'not-configured',
  });
});

test('getCloudCatalogModels excludes self-hosted models', () => {
  const providers = [
    {
      id: 'gemini',
      name: 'Gemini',
      inferenceConnections: [{ name: 'default', type: 'cloud', status: 'started', models: [{ label: 'gemini-pro' }] }],
    },
    {
      id: 'openshift-ai',
      name: 'OpenShift AI',
      inferenceConnections: [
        { name: 'cluster', type: 'self-hosted', status: 'started', models: [{ label: 'llama-3' }] },
      ],
    },
  ] as unknown as ProviderInfo[];

  const result = getCloudCatalogModels(providers);
  expect(result).toHaveLength(1);
  expect(result[0].providerId).toBe('gemini');
});

test('getCloudConnectionSummaries excludes self-hosted connections', () => {
  const providers = [
    {
      id: 'gemini',
      name: 'Gemini',
      internalId: 'gemini-internal',
      inferenceConnections: [{ name: 'default', type: 'cloud', status: 'started', models: [{ label: 'gemini-pro' }] }],
    },
    {
      id: 'openshift-ai',
      name: 'OpenShift AI',
      internalId: 'oai-internal',
      inferenceConnections: [
        { name: 'cluster', type: 'self-hosted', status: 'started', models: [{ label: 'llama-3' }] },
      ],
    },
  ] as unknown as ProviderInfo[];

  const result = getCloudConnectionSummaries(providers);
  expect(result).toHaveLength(1);
  expect(result[0].providerId).toBe('gemini');
});

test('getInHouseCatalogModels returns only self-hosted models', () => {
  const providers = [
    {
      id: 'gemini',
      name: 'Gemini',
      inferenceConnections: [{ name: 'default', type: 'cloud', status: 'started', models: [{ label: 'gemini-pro' }] }],
    },
    {
      id: 'openshift-ai',
      name: 'OpenShift AI',
      inferenceConnections: [
        {
          name: 'cluster',
          type: 'self-hosted',
          status: 'started',
          models: [{ label: 'llama-3' }, { label: 'mistral' }],
        },
      ],
    },
    {
      id: 'ollama',
      name: 'Ollama',
      inferenceConnections: [{ name: 'local', type: 'local', status: 'started', models: [{ label: 'phi-3' }] }],
    },
  ] as unknown as ProviderInfo[];

  const result = getInHouseCatalogModels(providers);
  expect(result).toHaveLength(2);
  expect(result.every(m => m.providerId === 'openshift-ai')).toBe(true);
  expect(result.map(m => m.label)).toEqual(['llama-3', 'mistral']);
});

test('getInHouseCatalogModels returns empty when no self-hosted providers', () => {
  const providers = [
    {
      id: 'gemini',
      name: 'Gemini',
      inferenceConnections: [{ name: 'default', type: 'cloud', status: 'started', models: [{ label: 'gemini-pro' }] }],
    },
  ] as unknown as ProviderInfo[];

  expect(getInHouseCatalogModels(providers)).toEqual([]);
});

test('getInHouseConnectionSummaries returns only self-hosted connections', () => {
  const providers = [
    {
      id: 'gemini',
      name: 'Gemini',
      internalId: 'gemini-internal',
      inferenceConnections: [{ name: 'default', type: 'cloud', status: 'started', models: [{ label: 'gemini-pro' }] }],
    },
    {
      id: 'openshift-ai',
      name: 'OpenShift AI',
      internalId: 'oai-internal',
      inferenceConnections: [
        { name: 'cluster', type: 'self-hosted', status: 'started', models: [{ label: 'llama-3' }] },
      ],
    },
  ] as unknown as ProviderInfo[];

  const result = getInHouseConnectionSummaries(providers);
  expect(result).toHaveLength(1);
  expect(result[0]).toMatchObject({
    providerName: 'OpenShift AI',
    providerId: 'openshift-ai',
    connectionType: 'self-hosted',
    status: 'started',
    modelCount: 1,
  });
});

test('getInHouseConnectionSummaries returns empty when no self-hosted providers', () => {
  const providers = [
    {
      id: 'ollama',
      name: 'Ollama',
      internalId: 'ollama-internal',
      inferenceConnections: [{ name: 'local', type: 'local', status: 'started', models: [{ label: 'phi-3' }] }],
    },
  ] as unknown as ProviderInfo[];

  expect(getInHouseConnectionSummaries(providers)).toEqual([]);
});
