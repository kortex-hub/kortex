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

import type { Agent } from '@openkaiden/api';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import type { ApiSenderType } from '/@api/api-sender/api-sender-type.js';
import type { CatalogModelInfo } from '/@api/model-registry-info.js';

import { AgentRegistry } from './agent-registry.js';
import type { ModelRegistry } from './model-registry.js';

const apiSender: ApiSenderType = {
  send: vi.fn(),
  receive: vi.fn(),
};

const modelRegistry: ModelRegistry = {
  getCatalogModels: vi.fn(),
  onChange: vi.fn(),
} as unknown as ModelRegistry;

let agentRegistry: AgentRegistry;

function createAgent(overrides?: Partial<Agent>): Agent {
  return {
    id: 'test-agent',
    name: 'Test Agent',
    description: 'A test agent',
    ...overrides,
  };
}

function createCatalogModel(llmMetadataName?: string): CatalogModelInfo {
  return {
    providerId: 'provider-1',
    providerName: 'Provider 1',
    connectionName: 'connection-1',
    type: 'cloud',
    label: 'model-label',
    connectionStatus: 'started',
    llmMetadata: llmMetadataName ? { name: llmMetadataName } : undefined,
  };
}

describe('AgentRegistry', () => {
  beforeEach(() => {
    agentRegistry = new AgentRegistry(apiSender, modelRegistry);
    vi.mocked(modelRegistry.getCatalogModels).mockReturnValue([]);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('registerAgent', () => {
    test('sends agent-registry:create event via apiSender', () => {
      const agent = createAgent();
      agentRegistry.registerAgent(agent);

      expect(apiSender.send).toHaveBeenCalledWith('agent-registry:create', agent.id);
    });

    test('fires onDidRegisterAgent event with the agent', () => {
      const listener = vi.fn();
      agentRegistry.onDidRegisterAgent(listener);

      const agent = createAgent();
      agentRegistry.registerAgent(agent);

      expect(listener).toHaveBeenCalledWith({ agent });
    });

    test('throws when registering duplicate agent id', () => {
      const agent = createAgent();
      agentRegistry.registerAgent(agent);

      expect(() => agentRegistry.registerAgent(agent)).toThrow(`Agent with id 'test-agent' is already registered`);
    });

    test('returns a Disposable that removes the agent', async () => {
      const agent = createAgent();
      const disposable = agentRegistry.registerAgent(agent);

      expect(await agentRegistry.getAgentInfos()).toHaveLength(1);

      disposable.dispose();

      expect(await agentRegistry.getAgentInfos()).toHaveLength(0);
    });

    test('dispose sends agent-registry:remove event', () => {
      const agent = createAgent();
      const disposable = agentRegistry.registerAgent(agent);

      disposable.dispose();

      expect(apiSender.send).toHaveBeenCalledWith('agent-registry:remove', agent.id);
    });

    test('dispose fires onDidUnregisterAgent event', () => {
      const listener = vi.fn();
      agentRegistry.onDidUnregisterAgent(listener);

      const agent = createAgent();
      const disposable = agentRegistry.registerAgent(agent);
      disposable.dispose();

      expect(listener).toHaveBeenCalledWith({ id: agent.id });
    });
  });

  describe('getAgentInfos', () => {
    test('returns empty array when no agents registered', async () => {
      expect(await agentRegistry.getAgentInfos()).toEqual([]);
    });

    test('returns agent info for registered agents', async () => {
      const agent = createAgent({ tags: ['cloud', 'recommended'] });
      agentRegistry.registerAgent(agent);

      const infos = await agentRegistry.getAgentInfos();
      expect(infos).toHaveLength(1);
      expect(infos[0]).toEqual(
        expect.objectContaining({
          id: 'test-agent',
          name: 'Test Agent',
          description: 'A test agent',
          tags: ['cloud', 'recommended'],
        }),
      );
    });

    test('returns multiple agents', async () => {
      agentRegistry.registerAgent(createAgent({ id: 'agent-1', name: 'Agent 1' }));
      agentRegistry.registerAgent(createAgent({ id: 'agent-2', name: 'Agent 2' }));

      const infos = await agentRegistry.getAgentInfos();
      expect(infos).toHaveLength(2);
    });

    test('caches agentInfo after first call', async () => {
      const isSupportedModelType = vi.fn().mockReturnValue(true);
      agentRegistry.registerAgent(createAgent({ isSupportedModelType }));
      vi.mocked(modelRegistry.getCatalogModels).mockReturnValue([createCatalogModel('anthropic')]);

      await agentRegistry.getAgentInfos();
      await agentRegistry.getAgentInfos();

      expect(isSupportedModelType).toHaveBeenCalledTimes(1);
    });
  });

  describe('getAgent', () => {
    test('returns undefined for unknown id', async () => {
      expect(await agentRegistry.getAgent('unknown')).toBeUndefined();
    });

    test('returns agent info for known id', async () => {
      const agent = createAgent();
      agentRegistry.registerAgent(agent);

      const result = await agentRegistry.getAgent('test-agent');
      expect(result).toBeDefined();
      expect(result!.name).toBe('Test Agent');
    });
  });

  describe('getModelTypes', () => {
    test('filters model types using isSupportedModelType callback', async () => {
      vi.mocked(modelRegistry.getCatalogModels).mockReturnValue([
        createCatalogModel('anthropic'),
        createCatalogModel('openai'),
        createCatalogModel('gemini'),
      ]);

      const result = await agentRegistry.getModelTypes(type => type.name === 'anthropic');
      expect(result).toEqual([{ name: 'anthropic' }]);
    });

    test('deduplicates model types', async () => {
      vi.mocked(modelRegistry.getCatalogModels).mockReturnValue([
        createCatalogModel('anthropic'),
        createCatalogModel('anthropic'),
      ]);

      const result = await agentRegistry.getModelTypes(() => true);
      expect(result).toEqual([{ name: 'anthropic' }]);
    });

    test('skips models without llmMetadata name', async () => {
      vi.mocked(modelRegistry.getCatalogModels).mockReturnValue([
        createCatalogModel(),
        createCatalogModel('anthropic'),
      ]);

      const result = await agentRegistry.getModelTypes(() => true);
      expect(result).toEqual([{ name: 'anthropic' }]);
    });

    test('supports async callback', async () => {
      vi.mocked(modelRegistry.getCatalogModels).mockReturnValue([createCatalogModel('anthropic')]);

      const result = await agentRegistry.getModelTypes(async type => type.name === 'anthropic');
      expect(result).toEqual([{ name: 'anthropic' }]);
    });
  });

  describe('getRuntimes', () => {
    test('returns podman when isSupportedRuntime returns true for podman', async () => {
      const result = await agentRegistry.getRuntimes(runtime => runtime === 'podman');
      expect(result).toEqual(['podman']);
    });

    test('returns openshell when isSupportedRuntime returns true for openshell', async () => {
      const result = await agentRegistry.getRuntimes(runtime => runtime === 'openshell');
      expect(result).toEqual(['openshell']);
    });

    test('returns both runtimes when both supported', async () => {
      const result = await agentRegistry.getRuntimes(() => true);
      expect(result).toEqual(['podman', 'openshell']);
    });

    test('returns empty array when none supported', async () => {
      const result = await agentRegistry.getRuntimes(() => false);
      expect(result).toEqual([]);
    });

    test('supports async callback', async () => {
      const result = await agentRegistry.getRuntimes(async runtime => runtime === 'podman');
      expect(result).toEqual(['podman']);
    });
  });

  describe('toAgentInfo', () => {
    test('returns agent info without supported types when callbacks absent', async () => {
      const agent = createAgent();
      const info = await agentRegistry.toAgentInfo(agent);

      expect(info).toEqual({
        id: 'test-agent',
        name: 'Test Agent',
        description: 'A test agent',
        icon: undefined,
        tags: undefined,
        supportedModelTypes: undefined,
        supportedRuntimes: undefined,
      });
    });

    test('populates supportedModelTypes when isSupportedModelType is provided', async () => {
      vi.mocked(modelRegistry.getCatalogModels).mockReturnValue([
        createCatalogModel('anthropic'),
        createCatalogModel('openai'),
      ]);
      const agent = createAgent({
        isSupportedModelType: type => type.name === 'anthropic',
      });

      const info = await agentRegistry.toAgentInfo(agent);
      expect(info.supportedModelTypes).toEqual([{ name: 'anthropic' }]);
    });

    test('populates supportedRuntimes when isSupportedRuntime is provided', async () => {
      const agent = createAgent({
        isSupportedRuntime: runtime => runtime === 'podman',
      });

      const info = await agentRegistry.toAgentInfo(agent);
      expect(info.supportedRuntimes).toEqual(['podman']);
    });

    test('includes icon and tags', async () => {
      const agent = createAgent({
        icon: { icon: 'my-icon', logo: 'my-logo' },
        tags: ['cloud', 'recommended'],
      });

      const info = await agentRegistry.toAgentInfo(agent);
      expect(info.icon).toEqual({ icon: 'my-icon', logo: 'my-logo' });
      expect(info.tags).toEqual(['cloud', 'recommended']);
    });
  });
});
