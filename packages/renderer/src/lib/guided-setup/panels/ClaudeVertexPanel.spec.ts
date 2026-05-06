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

import { faGoogle } from '@fortawesome/free-brands-svg-icons';
import { fireEvent, render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import type { Writable } from 'svelte/store';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { fetchProviders, providerInfos } from '/@/stores/providers';
import type { ProviderInfo } from '/@api/provider-info';

import type { AgentDefinition } from '../agent-registry';
import type { OnboardingState } from '../guided-setup-steps';
import ClaudeVertexPanel from './ClaudeVertexPanel.svelte';

vi.mock(import('/@/stores/providers'), async () => {
  const { writable } = await import('svelte/store');
  return {
    providerInfos: writable<ProviderInfo[]>([]),
    fetchProviders: vi.fn().mockResolvedValue([]),
  };
});

const vertexDefinition: AgentDefinition = {
  cliName: 'claude-vertex',
  cliAgent: 'claude',
  title: 'Claude on Vertex AI',
  description: 'Run Claude Code through Google Cloud Vertex AI using your GCP project credentials.',
  badge: 'Vertex AI',
  icon: faGoogle,
  colorClass: 'bg-gradient-to-br from-blue-500 to-blue-600',
  providerSelector: 'kaiden.vertex-ai:vertex-ai',
};

function stubVertexProvider(options?: { withModels?: boolean }): void {
  const models = options?.withModels ? [{ label: 'claude-sonnet-4-6' }, { label: 'claude-opus-4-5' }] : [];
  const providers = [
    {
      id: 'vertex-ai',
      internalId: 'vertex-ai-internal-1',
      inferenceConnections: models.length > 0 ? [{ type: 'cloud', status: 'started', models }] : [],
      inferenceProviderConnectionCreation: true,
    },
  ];
  (providerInfos as Writable<ProviderInfo[]>).set(providers as unknown as ProviderInfo[]);
}

function stubNoProvider(): void {
  (providerInfos as Writable<ProviderInfo[]>).set([]);
}

let onboarding: OnboardingState;

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.resetAllMocks();
  onboarding = { agent: 'claude-vertex', workspaceSetting: {} };
  vi.stubGlobal('createInferenceProviderConnection', vi.fn().mockResolvedValue(undefined));
  vi.stubGlobal('openDialog', vi.fn().mockResolvedValue(undefined));
  vi.stubGlobal('openExternal', vi.fn().mockResolvedValue(undefined));
  stubVertexProvider();
});

function renderPanel(definition: AgentDefinition = vertexDefinition): void {
  render(ClaudeVertexPanel, { definition, onboarding });
}

describe('rendering', () => {
  test('renders the Vertex AI panel', () => {
    renderPanel();

    expect(screen.getByTestId('claude-vertex-panel')).toBeInTheDocument();
    expect(screen.getByText('Google Cloud Vertex AI')).toBeInTheDocument();
  });

  test('shows the form with project ID, region, and credentials file inputs', () => {
    renderPanel();

    expect(screen.getByTestId('claude-vertex-form')).toBeInTheDocument();
    expect(screen.getByLabelText('Google Cloud project ID')).toBeInTheDocument();
    expect(screen.getByLabelText('Region')).toBeInTheDocument();
    expect(screen.getByLabelText('Credentials file')).toBeInTheDocument();
  });

  test('shows warning when Vertex AI provider extension is not detected', () => {
    stubNoProvider();
    renderPanel();

    expect(screen.getByTestId('vertex-provider-missing')).toBeInTheDocument();
    expect(screen.getByLabelText('Google Cloud project ID')).toBeDisabled();
    expect(screen.getByLabelText('Region')).toBeDisabled();
    expect(screen.getByLabelText('Credentials file')).toBeDisabled();
  });

  test('region input defaults to global', () => {
    renderPanel();

    const regionInput = screen.getByLabelText('Region') as HTMLInputElement;
    expect(regionInput.value).toBe('global');
  });

  test('shows browse button for credentials file', () => {
    renderPanel();

    expect(screen.getByLabelText('Browse credentials file')).toBeInTheDocument();
  });

  test('shows Vertex AI documentation link', () => {
    renderPanel();

    expect(screen.getByText(/Vertex AI documentation/)).toBeInTheDocument();
  });

  test('does not show error message initially', () => {
    renderPanel();

    expect(screen.queryByText(/Please enter your Google Cloud project ID/)).not.toBeInTheDocument();
  });
});

describe('beforeAdvance callback', () => {
  test('registers beforeAdvance on onboarding state', () => {
    renderPanel();

    expect(onboarding.beforeAdvance).toBeDefined();
    expect(typeof onboarding.beforeAdvance).toBe('function');
  });

  test('returns false and shows error when project ID is empty', async () => {
    renderPanel();

    const result = await onboarding.beforeAdvance!();

    expect(result).toBe(false);
    expect(screen.getByText(/Please enter your Google Cloud project ID/)).toBeInTheDocument();
  });

  test('returns false and shows error when region is empty', async () => {
    renderPanel();

    await userEvent.type(screen.getByLabelText('Google Cloud project ID'), 'my-project');

    const regionInput = screen.getByLabelText('Region') as HTMLInputElement;
    await userEvent.clear(regionInput);

    const result = await onboarding.beforeAdvance!();

    expect(result).toBe(false);
    expect(screen.getByText(/Please enter a region/)).toBeInTheDocument();
  });

  test('returns false and shows error when credentials file is empty', async () => {
    renderPanel();

    await userEvent.type(screen.getByLabelText('Google Cloud project ID'), 'my-project');

    const result = await onboarding.beforeAdvance!();

    expect(result).toBe(false);
    expect(screen.getByText(/Please provide the path to your gcloud credentials file/)).toBeInTheDocument();
  });

  test('returns false when provider is not available', async () => {
    stubNoProvider();
    renderPanel();

    const result = await onboarding.beforeAdvance!();

    expect(result).toBe(false);
    expect(screen.getByText(/Vertex AI provider extension is not available/)).toBeInTheDocument();
  });

  test('creates inference connection with factory params when all inputs are valid', async () => {
    vi.mocked(fetchProviders).mockImplementation(async () => {
      stubVertexProvider({ withModels: true });
      return [] as ProviderInfo[];
    });

    renderPanel();

    await userEvent.type(screen.getByLabelText('Google Cloud project ID'), 'my-gcp-project');
    await userEvent.type(
      screen.getByLabelText('Credentials file'),
      '/home/user/.config/gcloud/application_default_credentials.json',
    );

    const result = await onboarding.beforeAdvance!();

    expect(result).toBe(true);
    expect(window.createInferenceProviderConnection).toHaveBeenCalledWith(
      'vertex-ai-internal-1',
      {
        'vertex-ai.factory.projectId': 'my-gcp-project',
        'vertex-ai.factory.region': 'global',
        'vertex-ai.factory.credentialsFile': '/home/user/.config/gcloud/application_default_credentials.json',
      },
      expect.any(Symbol),
      expect.any(Function),
      undefined,
      undefined,
    );
  });

  test('stores vertexConfig in onboarding state on success', async () => {
    vi.mocked(fetchProviders).mockImplementation(async () => {
      stubVertexProvider({ withModels: true });
      return [] as ProviderInfo[];
    });

    renderPanel();

    await userEvent.type(screen.getByLabelText('Google Cloud project ID'), 'my-gcp-project');
    await userEvent.type(
      screen.getByLabelText('Credentials file'),
      '/home/user/.config/gcloud/application_default_credentials.json',
    );

    const regionInput = screen.getByLabelText('Region') as HTMLInputElement;
    await userEvent.clear(regionInput);
    await userEvent.type(regionInput, 'us-east5');

    await onboarding.beforeAdvance!();

    expect(onboarding.workspaceSetting).toEqual({
      defaultAgentSettings: {
        'claude-vertex': {
          workspaceConfiguration: {
            environment: [
              {
                name: 'CLAUDE_CODE_USE_VERTEX',
                value: '1',
              },
              {
                name: 'CLOUD_ML_REGION',
                value: 'us-east5',
              },
              {
                name: 'ANTHROPIC_VERTEX_PROJECT_ID',
                value: 'my-gcp-project',
              },
            ],
            mounts: [
              {
                host: '/home/user/.config/gcloud/application_default_credentials.json',
                ro: true,
                target: '$HOME/.config/gcloud/application_default_credentials.json',
              },
            ],
          },
        },
      },
    });
  });

  test('returns false and shows error when inference connection fails', async () => {
    vi.mocked(window.createInferenceProviderConnection).mockRejectedValue(new Error('Credentials file not found'));

    renderPanel();

    await userEvent.type(screen.getByLabelText('Google Cloud project ID'), 'my-project');
    await userEvent.type(screen.getByLabelText('Credentials file'), '/bad/path.json');

    const result = await onboarding.beforeAdvance!();

    expect(result).toBe(false);
    expect(screen.getByText('Credentials file not found')).toBeInTheDocument();
    expect(onboarding.workspaceSetting).toEqual({});
  });

  test('trims whitespace from inputs', async () => {
    vi.mocked(fetchProviders).mockImplementation(async () => {
      stubVertexProvider({ withModels: true });
      return [] as ProviderInfo[];
    });

    renderPanel();

    await userEvent.type(screen.getByLabelText('Google Cloud project ID'), '  my-project  ');
    await userEvent.type(screen.getByLabelText('Credentials file'), '  /home/user/creds.json  ');

    const regionInput = screen.getByLabelText('Region') as HTMLInputElement;
    await userEvent.clear(regionInput);
    await userEvent.type(regionInput, '  europe-west1  ');

    await onboarding.beforeAdvance!();

    expect(window.createInferenceProviderConnection).toHaveBeenCalledWith(
      'vertex-ai-internal-1',
      {
        'vertex-ai.factory.projectId': 'my-project',
        'vertex-ai.factory.region': 'europe-west1',
        'vertex-ai.factory.credentialsFile': '/home/user/creds.json',
      },
      expect.any(Symbol),
      expect.any(Function),
      undefined,
      undefined,
    );
  });
});

describe('already connected', () => {
  function stubConnectedProvider(): void {
    const providers = [
      {
        id: 'vertex-ai',
        internalId: 'vertex-ai-internal-1',
        inferenceConnections: [
          {
            type: 'cloud',
            status: 'started',
            models: [{ label: 'claude-sonnet-4-6' }, { label: 'claude-opus-4-5' }],
          },
        ],
        inferenceProviderConnectionCreation: true,
      },
    ];
    (providerInfos as Writable<ProviderInfo[]>).set(providers as unknown as ProviderInfo[]);
  }

  test('shows already-connected message when inference connection with models exists', () => {
    stubConnectedProvider();
    renderPanel();

    expect(screen.getByTestId('vertex-already-connected')).toBeInTheDocument();
    expect(screen.getByText('Connection configured')).toBeInTheDocument();
    expect(screen.getByText(/2 models/)).toBeInTheDocument();
  });

  test('hides form when already connected', () => {
    stubConnectedProvider();
    renderPanel();

    expect(screen.queryByTestId('claude-vertex-form')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Google Cloud project ID')).not.toBeInTheDocument();
  });

  test('beforeAdvance returns true immediately when already connected', async () => {
    stubConnectedProvider();
    renderPanel();

    const result = await onboarding.beforeAdvance!();

    expect(result).toBe(true);
    expect(window.createInferenceProviderConnection).not.toHaveBeenCalled();
    expect(onboarding.workspaceSetting).toEqual({});
  });
});

describe('credentials browse', () => {
  test('opens file dialog when browse button is clicked', async () => {
    vi.mocked(window.openDialog).mockResolvedValue(['/home/user/.config/gcloud/application_default_credentials.json']);
    renderPanel();

    await fireEvent.click(screen.getByLabelText('Browse credentials file'));

    expect(window.openDialog).toHaveBeenCalledWith({
      title: 'Select Google Cloud credentials file',
      selectors: ['openFile'],
    });
  });

  test('sets credentials file from dialog result', async () => {
    vi.mocked(window.openDialog).mockResolvedValue(['/home/user/.config/gcloud/application_default_credentials.json']);
    renderPanel();

    await fireEvent.click(screen.getByLabelText('Browse credentials file'));

    const credInput = screen.getByLabelText('Credentials file') as HTMLInputElement;
    expect(credInput.value).toBe('/home/user/.config/gcloud/application_default_credentials.json');
  });

  test('does not update credentials file when dialog is cancelled', async () => {
    vi.mocked(window.openDialog).mockResolvedValue(undefined as unknown as string[]);
    renderPanel();

    await fireEvent.click(screen.getByLabelText('Browse credentials file'));

    const credInput = screen.getByLabelText('Credentials file') as HTMLInputElement;
    expect(credInput.value).toBe('');
  });
});

describe('cleanup', () => {
  test('clears beforeAdvance when component is destroyed', () => {
    const { unmount } = render(ClaudeVertexPanel, { definition: vertexDefinition, onboarding });

    expect(onboarding.beforeAdvance).toBeDefined();

    unmount();

    expect(onboarding.beforeAdvance).toBeUndefined();
  });
});
