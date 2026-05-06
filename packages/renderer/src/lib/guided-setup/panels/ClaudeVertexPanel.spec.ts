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
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import type { OnboardingState } from '../guided-setup-steps';
import ClaudeVertexPanel from './ClaudeVertexPanel.svelte';

let onboarding: OnboardingState;

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.resetAllMocks();
  onboarding = { agent: 'claude-vertex', workspaceSetting: {} };
  vi.stubGlobal('openExternal', vi.fn().mockResolvedValue(undefined));
  vi.stubGlobal('openDialog', vi.fn().mockResolvedValue(undefined));
});

function renderPanel(): void {
  render(ClaudeVertexPanel, { onboarding });
}

describe('rendering', () => {
  test('renders the Vertex AI panel', () => {
    renderPanel();

    expect(screen.getByTestId('claude-vertex-panel')).toBeInTheDocument();
    expect(screen.getByText('Google Cloud Vertex AI')).toBeInTheDocument();
  });

  test('shows the form with environment variable inputs', () => {
    renderPanel();

    expect(screen.getByTestId('claude-vertex-form')).toBeInTheDocument();
    expect(screen.getByLabelText('ANTHROPIC_VERTEX_PROJECT_ID')).toBeInTheDocument();
    expect(screen.getByLabelText('CLOUD_ML_REGION')).toBeInTheDocument();
  });

  test('does not expose CLAUDE_CODE_USE_VERTEX field', () => {
    renderPanel();

    expect(screen.queryByLabelText('CLAUDE_CODE_USE_VERTEX')).not.toBeInTheDocument();
  });

  test('region input defaults to global', () => {
    renderPanel();

    const regionInput = screen.getByLabelText('CLOUD_ML_REGION') as HTMLInputElement;
    expect(regionInput.value).toBe('global');
  });

  test('shows informational text about workspace.json mapping', () => {
    renderPanel();

    expect(screen.getByText(/workspace\.json/)).toBeInTheDocument();
  });

  test('shows note about gcloud auth', () => {
    renderPanel();

    expect(screen.getByText(/gcloud auth application-default login/)).toBeInTheDocument();
  });

  test('shows note about ANTHROPIC_API_KEY not being required', () => {
    renderPanel();

    expect(screen.getByText(/ANTHROPIC_API_KEY/)).toBeInTheDocument();
  });

  test('shows credentials directory input with browse button', () => {
    renderPanel();

    expect(screen.getByLabelText('Google Cloud credentials path')).toBeInTheDocument();
    expect(screen.getByLabelText('Browse credentials')).toBeInTheDocument();
  });

  test('shows kdn README link', () => {
    renderPanel();

    expect(screen.getByText(/kdn README/)).toBeInTheDocument();
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

    await userEvent.type(screen.getByLabelText('ANTHROPIC_VERTEX_PROJECT_ID'), 'my-project');

    const regionInput = screen.getByLabelText('CLOUD_ML_REGION') as HTMLInputElement;
    await userEvent.clear(regionInput);

    const result = await onboarding.beforeAdvance!();

    expect(result).toBe(false);
    expect(screen.getByText(/Please enter a region/)).toBeInTheDocument();
  });

  test('returns false and shows error when credentials path is empty', async () => {
    renderPanel();

    await userEvent.type(screen.getByLabelText('ANTHROPIC_VERTEX_PROJECT_ID'), 'my-project');

    const result = await onboarding.beforeAdvance!();

    expect(result).toBe(false);
    expect(screen.getByText(/Please provide the path to your Google Cloud credentials directory/)).toBeInTheDocument();
  });

  test('returns true and stores vertexConfig when all inputs are valid', async () => {
    renderPanel();

    await userEvent.type(screen.getByLabelText('ANTHROPIC_VERTEX_PROJECT_ID'), 'my-gcp-project');
    await userEvent.type(screen.getByLabelText('Google Cloud credentials path'), '/home/user/.config/gcloud');

    const result = await onboarding.beforeAdvance!();

    expect(result).toBe(true);
    expect(onboarding.vertexConfig).toEqual({
      projectId: 'my-gcp-project',
      region: 'global',
      credentialsPath: '/home/user/.config/gcloud',
    });
  });

  test('stores custom region in vertexConfig', async () => {
    renderPanel();

    await userEvent.type(screen.getByLabelText('ANTHROPIC_VERTEX_PROJECT_ID'), 'my-project');
    await userEvent.type(screen.getByLabelText('Google Cloud credentials path'), '/home/user/.config/gcloud');

    const regionInput = screen.getByLabelText('CLOUD_ML_REGION') as HTMLInputElement;
    await userEvent.clear(regionInput);
    await userEvent.type(regionInput, 'europe-west1');

    const result = await onboarding.beforeAdvance!();

    expect(result).toBe(true);
    expect(onboarding.vertexConfig).toEqual({
      projectId: 'my-project',
      region: 'europe-west1',
      credentialsPath: '/home/user/.config/gcloud',
    });
  });

  test('trims whitespace from inputs', async () => {
    renderPanel();

    await userEvent.type(screen.getByLabelText('ANTHROPIC_VERTEX_PROJECT_ID'), '  my-project  ');
    await userEvent.type(screen.getByLabelText('Google Cloud credentials path'), '  /home/user/.config/gcloud  ');

    const regionInput = screen.getByLabelText('CLOUD_ML_REGION') as HTMLInputElement;
    await userEvent.clear(regionInput);
    await userEvent.type(regionInput, '  europe-west1  ');

    const result = await onboarding.beforeAdvance!();

    expect(result).toBe(true);
    expect(onboarding.vertexConfig).toEqual({
      projectId: 'my-project',
      region: 'europe-west1',
      credentialsPath: '/home/user/.config/gcloud',
    });
  });
});

describe('credentials browse', () => {
  test('opens file dialog when browse button is clicked', async () => {
    vi.mocked(window.openDialog).mockResolvedValue(['/home/user/.config/gcloud']);
    renderPanel();

    await fireEvent.click(screen.getByLabelText('Browse credentials'));

    expect(window.openDialog).toHaveBeenCalledWith({
      title: 'Select Google Cloud credentials directory',
      selectors: ['openDirectory'],
    });
  });

  test('sets credentials path from dialog result', async () => {
    vi.mocked(window.openDialog).mockResolvedValue(['/home/user/.config/gcloud']);
    renderPanel();

    await fireEvent.click(screen.getByLabelText('Browse credentials'));

    const credInput = screen.getByLabelText('Google Cloud credentials path') as HTMLInputElement;
    expect(credInput.value).toBe('/home/user/.config/gcloud');
  });

  test('does not update credentials path when dialog is cancelled', async () => {
    vi.mocked(window.openDialog).mockResolvedValue(undefined as unknown as string[]);
    renderPanel();

    await fireEvent.click(screen.getByLabelText('Browse credentials'));

    const credInput = screen.getByLabelText('Google Cloud credentials path') as HTMLInputElement;
    expect(credInput.value).toBe('');
  });
});

describe('cleanup', () => {
  test('clears beforeAdvance when component is destroyed', () => {
    const { unmount } = render(ClaudeVertexPanel, { onboarding });

    expect(onboarding.beforeAdvance).toBeDefined();

    unmount();

    expect(onboarding.beforeAdvance).toBeUndefined();
  });
});
