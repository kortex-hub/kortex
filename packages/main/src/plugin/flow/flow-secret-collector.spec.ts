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

import type { ProviderInferenceConnection } from '@kortex-app/api';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import type { ProviderImpl } from '../provider-impl.js';
import type { ProviderRegistry } from '../provider-registry.js';
import { FlowSecretCollector } from './flow-secret-collector.js';

describe('FlowSecretCollector', () => {
  let flowSecretCollector: FlowSecretCollector;
  let providerRegistryMock: ProviderRegistry;

  beforeEach(() => {
    providerRegistryMock = {
      getProvider: vi.fn(),
      getInferenceConnections: vi.fn(),
    } as unknown as ProviderRegistry;

    flowSecretCollector = new FlowSecretCollector(providerRegistryMock);
  });

  test('should return empty array when flow connection not found', async () => {
    vi.mocked(providerRegistryMock.getProvider).mockReturnValue({
      flowConnections: [],
    } as unknown as ProviderImpl);

    const result = await flowSecretCollector.collectSecretsForFlow('flow-id', 'goose', 'connection-name');

    expect(result).toEqual([]);
  });

  test('should collect both provider credentials and MCP headers', async () => {
    const mockFlowContent = `
settings:
  goose_provider: google
  goose_model: gemini-flash-latest
extensions:
  - name: github-mcp
    type: streamable_http
    uri: https://api.github.com/mcp
    headers:
      Authorization: Bearer github-token-67890
      X-API-Key: api-key-abcdef
`;

    const mockFlowConnection = {
      name: 'connection-name',
      flow: {
        read: vi.fn().mockResolvedValue(mockFlowContent),
      },
    };

    const mockInferenceConnection = {
      providerId: 'gemini',
      connection: {
        name: 'Gemini Connection',
        credentials: vi.fn().mockReturnValue({
          'gemini:tokens': 'secret-api-key-12345',
        }),
      },
    };

    vi.mocked(providerRegistryMock.getProvider).mockReturnValue({
      flowConnections: [mockFlowConnection],
    } as unknown as ProviderImpl);

    vi.mocked(providerRegistryMock.getInferenceConnections).mockReturnValue([
      mockInferenceConnection,
    ] as unknown as ProviderInferenceConnection[]);

    const result = await flowSecretCollector.collectSecretsForFlow('flow-id', 'goose', 'connection-name');

    expect(result).toHaveLength(3);
    expect(result).toContain('secret-api-key-12345');
    expect(result).toContain('Bearer github-token-67890');
    expect(result).toContain('api-key-abcdef');
  });

  test('should handle multiple inference connections for same provider', async () => {
    const mockFlowContent = `
settings:
  goose_provider: google
  goose_model: gemini-flash-latest
`;

    const mockFlowConnection = {
      name: 'connection-name',
      flow: {
        read: vi.fn().mockResolvedValue(mockFlowContent),
      },
    };

    const mockInferenceConnections = [
      {
        providerId: 'gemini',
        connection: {
          name: 'Gemini Connection 1',
          credentials: vi.fn().mockReturnValue({
            'gemini:tokens': 'api-key-1',
          }),
        },
      },
      {
        providerId: 'gemini',
        connection: {
          name: 'Gemini Connection 2',
          credentials: vi.fn().mockReturnValue({
            'gemini:tokens': 'api-key-2',
          }),
        },
      },
    ];

    vi.mocked(providerRegistryMock.getProvider).mockReturnValue({
      flowConnections: [mockFlowConnection],
    } as unknown as ProviderImpl);

    vi.mocked(providerRegistryMock.getInferenceConnections).mockReturnValue(
      mockInferenceConnections as unknown as ProviderInferenceConnection[],
    );

    const result = await flowSecretCollector.collectSecretsForFlow('flow-id', 'goose', 'connection-name');

    expect(result).toEqual(['api-key-1', 'api-key-2']);
  });

  test('should return empty array when no secrets found', async () => {
    const mockFlowContent = `
title: simple-flow
description: A flow without secrets
`;

    const mockFlowConnection = {
      name: 'connection-name',
      flow: {
        read: vi.fn().mockResolvedValue(mockFlowContent),
      },
    };

    vi.mocked(providerRegistryMock.getProvider).mockReturnValue({
      flowConnections: [mockFlowConnection],
    } as unknown as ProviderImpl);

    vi.mocked(providerRegistryMock.getInferenceConnections).mockReturnValue([]);

    const result = await flowSecretCollector.collectSecretsForFlow('flow-id', 'goose', 'connection-name');

    expect(result).toEqual([]);
  });

  test('should filter out non-string values from credentials and headers', async () => {
    const mockFlowContent = `
settings:
  goose_provider: google
  goose_model: gemini-flash-latest
`;

    const mockFlowConnection = {
      name: 'connection-name',
      flow: {
        read: vi.fn().mockResolvedValue(mockFlowContent),
      },
    };

    const mockInferenceConnection = {
      providerId: 'gemini',
      connection: {
        name: 'Gemini Connection',
        credentials: vi.fn().mockReturnValue({
          'gemini:tokens': 'valid-string-token',
          'gemini:config': { some: 'object' },
          'gemini:number': 12345,
        }),
      },
    };

    vi.mocked(providerRegistryMock.getProvider).mockReturnValue({
      flowConnections: [mockFlowConnection],
    } as unknown as ProviderImpl);

    vi.mocked(providerRegistryMock.getInferenceConnections).mockReturnValue([
      mockInferenceConnection,
    ] as unknown as ProviderInferenceConnection[]);

    const result = await flowSecretCollector.collectSecretsForFlow('flow-id', 'goose', 'connection-name');

    expect(result).toEqual(['valid-string-token']);
  });
});
