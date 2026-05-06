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

import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import type { Writable } from 'svelte/store';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { providerInfos } from '/@/stores/providers';
import type { ProviderInfo } from '/@api/provider-info';

import type { OnboardingState } from './guided-setup-steps';
import { createDefaultOnboardingState } from './guided-setup-steps';
import ModelStep from './ModelStep.svelte';

vi.mock(import('/@/navigation'));

vi.mock(import('/@/stores/providers'), async () => {
  const { writable } = await import('svelte/store');
  return {
    providerInfos: writable<ProviderInfo[]>([]),
    fetchProviders: vi.fn().mockResolvedValue([]),
  };
});

vi.mock(import('/@/stores/model-catalog'), async () => {
  const { writable } = await import('svelte/store');
  return {
    disabledModels: writable<Set<string>>(new Set()),
    modelKey: (providerId: string, label: string): string => `${providerId}::${label}`,
    isModelEnabled: (): boolean => true,
    toggleModel: vi.fn(),
  };
});

let onboarding: OnboardingState;

function stubProviders(providers: Partial<ProviderInfo>[]): void {
  (providerInfos as Writable<ProviderInfo[]>).set(providers as unknown as ProviderInfo[]);
}

const OPENCODE_PROVIDERS: Partial<ProviderInfo>[] = [
  {
    id: 'ollama',
    name: 'Ollama',
    inferenceConnections: [
      {
        name: 'default',
        type: 'local',
        status: 'started',
        models: [{ label: 'llama3.2:3b' }, { label: 'codellama:7b' }],
        llmMetadata: { name: 'ollama' },
      },
    ],
  } as unknown as ProviderInfo,
];

const CLAUDE_PROVIDERS: Partial<ProviderInfo>[] = [
  {
    id: 'claude',
    name: 'Claude',
    inferenceConnections: [
      {
        name: 'api-key',
        type: 'cloud',
        status: 'started',
        models: [{ label: 'claude-sonnet-4-20250514' }, { label: 'claude-3-5-haiku-20241022' }],
        llmMetadata: { name: 'anthropic' },
      },
    ],
  } as unknown as ProviderInfo,
];

const MIXED_PROVIDERS: Partial<ProviderInfo>[] = [...OPENCODE_PROVIDERS, ...CLAUDE_PROVIDERS];

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.resetAllMocks();
  onboarding = createDefaultOnboardingState();
  stubProviders([]);
});

function renderStep(overrides: Partial<OnboardingState> = {}): void {
  Object.assign(onboarding, overrides);
  render(ModelStep, {
    stepId: 'model-selection',
    title: 'Model',
    description: 'Select the default model for your coding agent.',
    onboarding,
  });
}

describe('rendering', () => {
  test('renders title and description', () => {
    renderStep();

    expect(screen.getByText('Default model for the agent')).toBeInTheDocument();
    expect(screen.getByText(/used by default in new workspaces/)).toBeInTheDocument();
  });

  test('shows no-models message when no providers exist', () => {
    renderStep();

    expect(screen.getByTestId('no-models')).toBeInTheDocument();
  });

  test('shows agent-specific inner text for claude agent', () => {
    stubProviders(CLAUDE_PROVIDERS);
    renderStep({ agent: 'claude' });

    expect(screen.getByText(/Claude Code rows/)).toBeInTheDocument();
  });
});

describe('opencode agent models', () => {
  test('displays local models for opencode agent', () => {
    stubProviders(OPENCODE_PROVIDERS);
    renderStep({ agent: 'opencode' });

    expect(screen.getByText('llama3.2:3b')).toBeInTheDocument();
    expect(screen.getByText('codellama:7b')).toBeInTheDocument();
  });

  test('auto-selects first model when none is pre-selected', async () => {
    stubProviders(OPENCODE_PROVIDERS);
    renderStep({ agent: 'opencode' });

    await waitFor(() => {
      expect(onboarding.model).toEqual({
        providerId: 'ollama',
        connectionName: 'default',
        label: 'llama3.2:3b',
      });
    });
  });

  test('shows all available models for opencode agent', () => {
    stubProviders(MIXED_PROVIDERS);
    renderStep({ agent: 'opencode' });

    expect(screen.getByText('llama3.2:3b')).toBeInTheDocument();
    expect(screen.getByText('claude-sonnet-4-20250514')).toBeInTheDocument();
  });
});

describe('claude agent models', () => {
  test('filters to anthropic models only for claude agent', () => {
    stubProviders(MIXED_PROVIDERS);
    renderStep({ agent: 'claude' });

    expect(screen.getByText('claude-sonnet-4-20250514')).toBeInTheDocument();
    expect(screen.getByText('claude-3-5-haiku-20241022')).toBeInTheDocument();
    expect(screen.queryByText('llama3.2:3b')).not.toBeInTheDocument();
  });

  test('auto-selects first claude model', async () => {
    stubProviders(CLAUDE_PROVIDERS);
    renderStep({ agent: 'claude' });

    await waitFor(() => {
      expect(onboarding.model).toEqual({
        providerId: 'claude',
        connectionName: 'api-key',
        label: 'claude-sonnet-4-20250514',
      });
    });
  });
});

describe('model selection', () => {
  test('updates onboarding.model when a model row is clicked', async () => {
    stubProviders(OPENCODE_PROVIDERS);
    renderStep({ agent: 'opencode' });

    const row = screen.getByTestId('model-row-codellama:7b');
    await fireEvent.click(row);

    await waitFor(() => {
      expect(onboarding.model).toEqual({
        providerId: 'ollama',
        connectionName: 'default',
        label: 'codellama:7b',
      });
    });
  });

  test('preserves pre-selected model from onboarding state', async () => {
    stubProviders(OPENCODE_PROVIDERS);
    renderStep({
      agent: 'opencode',
      model: { providerId: 'ollama', connectionName: 'ollama', label: 'codellama:7b' },
    });

    await waitFor(() => {
      expect(onboarding.model?.label).toBe('codellama:7b');
    });

    const radio = screen.getByRole('radio', { name: 'Use codellama:7b' });
    expect(radio).toBeChecked();
  });

  test('preserves model when catalog is empty (loading)', async () => {
    const seeded = { providerId: 'claude', connectionName: 'claude', label: 'claude-sonnet-4-20250514' };
    stubProviders([]);
    renderStep({ agent: 'claude', model: seeded });

    await waitFor(() => {
      expect(onboarding.model).toEqual(seeded);
    });
  });
});

describe('model radio selection', () => {
  test('auto-selected model has its radio checked', async () => {
    stubProviders(OPENCODE_PROVIDERS);
    renderStep({ agent: 'opencode' });

    await waitFor(() => {
      const radio = screen.getByRole('radio', { name: 'Use llama3.2:3b' });
      expect(radio).toBeChecked();
    });
  });

  test('shows selected model label below the table', async () => {
    stubProviders(OPENCODE_PROVIDERS);
    renderStep({ agent: 'opencode' });

    await waitFor(() => {
      const indicator = screen.getByTestId('selected-model');
      expect(indicator).toHaveTextContent('Selected: llama3.2:3b');
    });
  });
});
