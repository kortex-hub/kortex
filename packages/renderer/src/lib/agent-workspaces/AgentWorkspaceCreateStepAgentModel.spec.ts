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

import '@testing-library/jest-dom/vitest';

import { fireEvent, render, screen } from '@testing-library/svelte';
import { writable } from 'svelte/store';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import * as agentWorkspaceRuntimeStore from '/@/stores/agentworkspace-runtime';
import * as modelCatalogStore from '/@/stores/model-catalog';
import * as providersStore from '/@/stores/providers';
import type { ProviderInfo } from '/@api/provider-info';

import AgentWorkspaceCreateStepAgentModel from './AgentWorkspaceCreateStepAgentModel.svelte';

vi.mock(import('/@/navigation'));
vi.mock(import('/@/stores/providers'));
vi.mock(import('/@/stores/model-catalog'));
vi.mock(import('/@/stores/agentworkspace-runtime'));
vi.mock('/@/lib/guided-setup/agent-registry', () => ({
  agentDefinitions: [
    { cliName: 'opencode', title: 'OpenCode', description: 'Open-source agent.', badge: 'Recommended' },
    {
      cliName: 'claude',
      title: 'Claude Code',
      description: 'Anthropic Claude.',
      badge: 'Cloud',
      modelFilter: 'anthropic',
    },
    {
      cliName: 'claude-vertex',
      title: 'Claude on Vertex AI',
      description: 'Claude via Vertex AI.',
      modelFilter: 'anthropic',
    },
    { cliName: 'cursor', title: 'Cursor', description: 'AI code editor.' },
    { cliName: 'goose', title: 'Goose', description: 'Autonomous coding agent.', runtimes: ['podman'] },
  ],
}));

const mockAnthropicProvider: ProviderInfo = {
  id: 'claude',
  name: 'Anthropic',
  internalId: 'claude-internal',
  status: 'started',
  inferenceConnections: [
    {
      name: 'Anthropic Cloud',
      type: 'cloud',
      status: 'started',
      llmMetadata: { name: 'anthropic' },
      models: [{ label: 'claude-sonnet-4' }, { label: 'claude-opus-4' }],
    },
  ],
  inferenceProviderConnectionCreation: false,
} as unknown as ProviderInfo;

const mockOllamaProvider: ProviderInfo = {
  id: 'ollama',
  name: 'Ollama',
  internalId: 'ollama-internal',
  status: 'started',
  inferenceConnections: [
    {
      name: 'Ollama Local',
      type: 'local',
      status: 'started',
      llmMetadata: { name: 'ollama' },
      models: [{ label: 'llama3.2:3b' }],
    },
  ],
  inferenceProviderConnectionCreation: false,
} as unknown as ProviderInfo;

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.resetAllMocks();
  vi.mocked(providersStore).providerInfos = writable<ProviderInfo[]>([]);
  vi.mocked(agentWorkspaceRuntimeStore).agentWorkspaceRuntime = writable<string>('podman');
  vi.mocked(modelCatalogStore).disabledModels = writable<Set<string>>(new Set());
  vi.mocked(modelCatalogStore.isModelEnabled).mockImplementation(
    (disabled: Set<string>, providerId: string, label: string): boolean => !disabled.has(`${providerId}::${label}`),
  );
  vi.mocked(modelCatalogStore.modelKey).mockImplementation(
    (providerId: string, label: string): string => `${providerId}::${label}`,
  );
});

afterEach(() => {
  vi.useRealTimers();
});

test('renders all agent tiles from registry', () => {
  render(AgentWorkspaceCreateStepAgentModel);

  expect(screen.getByText('OpenCode')).toBeInTheDocument();
  expect(screen.getByText('Claude Code')).toBeInTheDocument();
  expect(screen.getByText('Claude on Vertex AI')).toBeInTheDocument();
  expect(screen.getByText('Cursor')).toBeInTheDocument();
  expect(screen.getByText('Goose')).toBeInTheDocument();
});

test('OpenCode tile has Recommended badge', () => {
  render(AgentWorkspaceCreateStepAgentModel);

  expect(screen.getByText('Recommended')).toBeInTheDocument();
});

test('model catalog hidden when no agent selected', () => {
  render(AgentWorkspaceCreateStepAgentModel);

  expect(screen.queryByText('Model for workspace')).not.toBeInTheDocument();
});

test('model catalog shown after agent selection', async () => {
  render(AgentWorkspaceCreateStepAgentModel);

  await fireEvent.click(screen.getByText('OpenCode'));

  expect(screen.getByText('Model for workspace')).toBeInTheDocument();
});

test('shows empty state when no providers configured', async () => {
  render(AgentWorkspaceCreateStepAgentModel);

  await fireEvent.click(screen.getByText('OpenCode'));

  expect(screen.getByText(/No model sources match/i)).toBeInTheDocument();
});

test('shows cloud models under Cloud category', async () => {
  vi.mocked(providersStore).providerInfos = writable<ProviderInfo[]>([mockAnthropicProvider]);

  render(AgentWorkspaceCreateStepAgentModel);

  await fireEvent.click(screen.getByText('OpenCode'));

  expect(screen.getByText('Cloud · LLM providers')).toBeInTheDocument();
  expect(screen.getByText('claude-sonnet-4')).toBeInTheDocument();
  expect(screen.getByText('claude-opus-4')).toBeInTheDocument();
});

test('shows local models under Local category', async () => {
  vi.mocked(providersStore).providerInfos = writable<ProviderInfo[]>([mockOllamaProvider]);

  render(AgentWorkspaceCreateStepAgentModel);

  await fireEvent.click(screen.getByText('OpenCode'));

  expect(screen.getByText('Local · Ollama & Ramalama')).toBeInTheDocument();
  expect(screen.getByText('llama3.2:3b')).toBeInTheDocument();
});

test('Claude agent filters to Anthropic models only', async () => {
  vi.mocked(providersStore).providerInfos = writable<ProviderInfo[]>([mockAnthropicProvider, mockOllamaProvider]);

  render(AgentWorkspaceCreateStepAgentModel);

  await fireEvent.click(screen.getByText('Claude Code'));

  expect(screen.getByText('claude-sonnet-4')).toBeInTheDocument();
  expect(screen.queryByText('llama3.2:3b')).not.toBeInTheDocument();
});

test('search filters model list', async () => {
  vi.mocked(providersStore).providerInfos = writable<ProviderInfo[]>([mockAnthropicProvider]);

  render(AgentWorkspaceCreateStepAgentModel);

  await fireEvent.click(screen.getByText('OpenCode'));

  const searchInput = screen.getByPlaceholderText('Filter models…');
  await fireEvent.input(searchInput, { target: { value: 'sonnet' } });

  expect(screen.getByText('claude-sonnet-4')).toBeInTheDocument();
  expect(screen.queryByText('claude-opus-4')).not.toBeInTheDocument();
});

test('switching agent keeps model if still compatible', async () => {
  vi.mocked(providersStore).providerInfos = writable<ProviderInfo[]>([mockAnthropicProvider]);

  render(AgentWorkspaceCreateStepAgentModel, {
    selectedAgent: 'opencode',
    selectedModel: { providerId: 'claude', connectionName: 'Anthropic Cloud', type: 'cloud', label: 'claude-opus-4' },
  });

  const initiallySelected = screen.getByRole('radio', { name: 'Use claude-opus-4' });
  screen.debug(undefined, 16384);
  expect(initiallySelected).toBeChecked();

  // Switching to Claude Code — claude-opus-4 is Anthropic, still compatible
  await fireEvent.click(screen.getByText('Claude Code'));

  expect(screen.getByRole('radio', { name: 'Use claude-opus-4' })).toBeChecked();
});

test('auto-selects first model when no model pre-selected', async () => {
  vi.mocked(providersStore).providerInfos = writable<ProviderInfo[]>([mockAnthropicProvider]);

  render(AgentWorkspaceCreateStepAgentModel, {
    selectedAgent: 'opencode',
    selectedModel: undefined,
  });

  const firstRadio = screen.getByRole('radio', { name: 'Use claude-sonnet-4' });
  expect(firstRadio).toBeChecked();
});

test('auto-selects first model when agent filters remove current selection', async () => {
  vi.mocked(providersStore).providerInfos = writable<ProviderInfo[]>([mockAnthropicProvider, mockOllamaProvider]);

  render(AgentWorkspaceCreateStepAgentModel, {
    selectedAgent: 'opencode',
    selectedModel: { providerId: 'ollama', connectionName: 'Ollama', type: 'local', label: 'llama3.2:3b' },
  });

  // Switching to Claude filters out Ollama models, should auto-select first Anthropic model
  await fireEvent.click(screen.getByText('Claude Code'));

  const firstRadio = screen.getByRole('radio', { name: 'Use claude-sonnet-4' });
  expect(firstRadio).toBeChecked();
});

test('disabled models are hidden from selection list', async () => {
  vi.mocked(providersStore).providerInfos = writable<ProviderInfo[]>([mockAnthropicProvider]);
  vi.mocked(modelCatalogStore).disabledModels = writable<Set<string>>(new Set(['claude::claude-opus-4']));

  render(AgentWorkspaceCreateStepAgentModel);

  await fireEvent.click(screen.getByText('OpenCode'));

  expect(screen.getByText('claude-sonnet-4')).toBeInTheDocument();
  expect(screen.queryByText('claude-opus-4')).not.toBeInTheDocument();
});

test('Open Models catalog link visible when agent selected', async () => {
  render(AgentWorkspaceCreateStepAgentModel);

  await fireEvent.click(screen.getByText('OpenCode'));

  expect(screen.getByText('Open Models catalog')).toBeInTheDocument();
});

test('agents without runtimes field are always shown', () => {
  vi.mocked(agentWorkspaceRuntimeStore).agentWorkspaceRuntime = writable<string>('docker');

  render(AgentWorkspaceCreateStepAgentModel);

  expect(screen.getByText('OpenCode')).toBeInTheDocument();
  expect(screen.getByText('Claude Code')).toBeInTheDocument();
  expect(screen.getByText('Cursor')).toBeInTheDocument();
});

test('agent with matching runtime is shown', () => {
  vi.mocked(agentWorkspaceRuntimeStore).agentWorkspaceRuntime = writable<string>('podman');

  render(AgentWorkspaceCreateStepAgentModel);

  expect(screen.getByText('Goose')).toBeInTheDocument();
});

test('agent with non-matching runtime is hidden', () => {
  vi.mocked(agentWorkspaceRuntimeStore).agentWorkspaceRuntime = writable<string>('docker');

  render(AgentWorkspaceCreateStepAgentModel);

  expect(screen.queryByText('Goose')).not.toBeInTheDocument();
});
