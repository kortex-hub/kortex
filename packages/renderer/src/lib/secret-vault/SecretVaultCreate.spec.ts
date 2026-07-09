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
import { beforeEach, expect, test, vi } from 'vitest';

import type { OpenshellProfile } from '/@api/openshell-gateway-info';

import SecretVaultCreate from './SecretVaultCreate.svelte';

vi.mock(import('/@/navigation'));

const MOCK_SERVICES: OpenshellProfile[] = [
  {
    id: 'github',
    display_name: 'GitHub',
    description: 'GitHub API provider',
    credentials: [
      { name: 'token', required: true, description: 'Personal access token', env_vars: ['GH_TOKEN', 'GITHUB_TOKEN'] },
    ],
  },
  {
    id: 'gemini',
    display_name: 'Gemini',
    description: 'Google Gemini API provider',
    credentials: [
      { name: 'api_key', required: true, description: 'API key', env_vars: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'] },
    ],
  },
];

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.resetAllMocks();
  vi.mocked(window.createSecret).mockResolvedValue({ name: 'test' });
  vi.mocked(window.listSecretServices).mockResolvedValue(MOCK_SERVICES);
});

test('renders type options from fetched services plus Other', async () => {
  render(SecretVaultCreate);

  await waitFor(() => {
    expect(screen.getByLabelText('GitHub')).toBeInTheDocument();
  });
  expect(screen.getByLabelText('Gemini')).toBeInTheDocument();
  expect(screen.getByLabelText('Other')).toBeInTheDocument();
});

test('defaults to Other type with full form fields', async () => {
  render(SecretVaultCreate);

  await waitFor(() => {
    expect(screen.getByLabelText('Other')).toBeInTheDocument();
  });

  expect(screen.getByText('Other Secret')).toBeInTheDocument();
  expect(screen.getByLabelText('Name')).toBeInTheDocument();
  expect(screen.getByLabelText('Secret value')).toBeInTheDocument();
  expect(screen.getByLabelText('Description')).toBeInTheDocument();
  expect(screen.getByLabelText('Host pattern')).toBeInTheDocument();
  expect(screen.getByText('Injection settings')).toBeInTheDocument();
  expect(screen.getByLabelText('Path pattern')).toBeInTheDocument();
  expect(screen.getByLabelText('Header name')).toBeInTheDocument();
  expect(screen.getByLabelText('Value format')).toBeInTheDocument();
});

test('hides injection fields and shows credential fields when a predefined service type is selected', async () => {
  render(SecretVaultCreate);

  await waitFor(() => {
    expect(screen.getByLabelText('GitHub')).toBeInTheDocument();
  });

  await fireEvent.click(screen.getByLabelText('GitHub'));

  expect(screen.getByText('GitHub Secret')).toBeInTheDocument();
  expect(screen.getByLabelText('Name')).toBeInTheDocument();
  expect(screen.getByLabelText('Token')).toBeInTheDocument();
  expect(screen.getByText('Token (Personal access token)')).toBeInTheDocument();
  expect(screen.queryByLabelText('Secret value')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Description')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Host pattern')).not.toBeInTheDocument();
  expect(screen.queryByText('Injection settings')).not.toBeInTheDocument();
});

test('shows profile description as subtitle for predefined service type', async () => {
  render(SecretVaultCreate);

  await waitFor(() => {
    expect(screen.getByLabelText('GitHub')).toBeInTheDocument();
  });

  await fireEvent.click(screen.getByLabelText('GitHub'));

  expect(screen.queryByText(/Configure a custom secret/)).not.toBeInTheDocument();
  expect(screen.getByText('GitHub API provider')).toBeInTheDocument();
});

test('Add Secret button is disabled when required fields are empty', async () => {
  render(SecretVaultCreate);

  await waitFor(() => {
    expect(screen.getByLabelText('Other')).toBeInTheDocument();
  });

  expect(screen.getByRole('button', { name: 'Add Secret' })).toBeDisabled();
});

test('Add Secret button is disabled for Other type without host pattern', async () => {
  render(SecretVaultCreate);

  await waitFor(() => {
    expect(screen.getByLabelText('Other')).toBeInTheDocument();
  });

  await fireEvent.input(screen.getByLabelText('Name'), { target: { value: 'my-secret' } });
  await fireEvent.input(screen.getByLabelText('Secret value'), { target: { value: 'secret-value' } });

  expect(screen.getByRole('button', { name: 'Add Secret' })).toBeDisabled();
});

test('cancel navigates back to secret vault', async () => {
  const { handleNavigation } = await import('/@/navigation');

  render(SecretVaultCreate);

  const cancelButton = screen.getByRole('button', { name: 'Cancel' });
  await fireEvent.click(cancelButton);

  expect(handleNavigation).toHaveBeenCalledWith({ page: 'secret-vault' });
});

test('submits Other secret with injection settings', async () => {
  const { handleNavigation } = await import('/@/navigation');

  render(SecretVaultCreate);

  await waitFor(() => {
    expect(screen.getByLabelText('Other')).toBeInTheDocument();
  });

  await fireEvent.input(screen.getByLabelText('Name'), { target: { value: 'my-api-key' } });
  await fireEvent.input(screen.getByLabelText('Secret value'), { target: { value: 'sk-123' } });
  await fireEvent.input(screen.getByLabelText('Description'), { target: { value: 'Production API key' } });
  await fireEvent.input(screen.getByLabelText('Host pattern'), { target: { value: 'api.example.com' } });
  await fireEvent.input(screen.getByLabelText('Header name'), { target: { value: 'Authorization' } });
  await fireEvent.input(screen.getByLabelText('Value format'), { target: { value: 'Bearer {value}' } });

  await fireEvent.click(screen.getByRole('button', { name: 'Add Secret' }));

  expect(window.createSecret).toHaveBeenCalledWith({
    name: 'my-api-key',
    type: 'other',
    value: 'sk-123',
    description: 'Production API key',
    hosts: ['api.example.com'],
    header: 'Authorization',
    headerTemplate: 'Bearer ${value}',
  });

  expect(handleNavigation).toHaveBeenCalledWith({ page: 'secret-vault' });
});

test('does not double-prefix ${value} when user types it directly in value format', async () => {
  render(SecretVaultCreate);

  await waitFor(() => {
    expect(screen.getByLabelText('Other')).toBeInTheDocument();
  });

  await fireEvent.input(screen.getByLabelText('Name'), { target: { value: 'my-api-key' } });
  await fireEvent.input(screen.getByLabelText('Secret value'), { target: { value: 'sk-123' } });
  await fireEvent.input(screen.getByLabelText('Host pattern'), { target: { value: 'api.example.com' } });
  await fireEvent.input(screen.getByLabelText('Header name'), { target: { value: 'Authorization' } });
  await fireEvent.input(screen.getByLabelText('Value format'), { target: { value: 'Bearer ${value}' } });

  await fireEvent.click(screen.getByRole('button', { name: 'Add Secret' }));

  expect(window.createSecret).toHaveBeenCalledWith(expect.objectContaining({ headerTemplate: 'Bearer ${value}' }));
});

test('submits Other secret using default Authorization header when header name is not changed', async () => {
  const { handleNavigation } = await import('/@/navigation');

  render(SecretVaultCreate);

  await waitFor(() => {
    expect(screen.getByLabelText('Other')).toBeInTheDocument();
  });

  await fireEvent.input(screen.getByLabelText('Name'), { target: { value: 'custom-key' } });
  await fireEvent.input(screen.getByLabelText('Secret value'), { target: { value: 'sk-abc' } });
  await fireEvent.input(screen.getByLabelText('Host pattern'), { target: { value: 'api.custom.io' } });

  await fireEvent.click(screen.getByRole('button', { name: 'Add Secret' }));

  expect(window.createSecret).toHaveBeenCalledWith({
    name: 'custom-key',
    type: 'other',
    value: 'sk-abc',
    hosts: ['api.custom.io'],
    header: 'Authorization',
  });

  expect(handleNavigation).toHaveBeenCalledWith({ page: 'secret-vault' });
});

test('submits predefined service type with credential fields as SecretValue', async () => {
  const { handleNavigation } = await import('/@/navigation');

  render(SecretVaultCreate);

  await waitFor(() => {
    expect(screen.getByLabelText('GitHub')).toBeInTheDocument();
  });

  await fireEvent.click(screen.getByLabelText('GitHub'));
  await fireEvent.input(screen.getByLabelText('Name'), { target: { value: 'gh-token' } });
  await fireEvent.input(screen.getByLabelText('Token'), { target: { value: 'ghp_abc123' } });

  await fireEvent.click(screen.getByRole('button', { name: 'Add Secret' }));

  expect(window.createSecret).toHaveBeenCalledWith({
    name: 'gh-token',
    type: 'github',
    value: {
      credentials: {
        GH_TOKEN: 'ghp_abc123',
        GITHUB_TOKEN: 'ghp_abc123',
      },
    },
  });

  expect(handleNavigation).toHaveBeenCalledWith({ page: 'secret-vault' });
});

test('displays error when createSecret fails', async () => {
  vi.mocked(window.createSecret).mockRejectedValueOnce(new Error('Storage unavailable'));

  render(SecretVaultCreate);

  await waitFor(() => {
    expect(screen.getByLabelText('GitHub')).toBeInTheDocument();
  });

  await fireEvent.click(screen.getByLabelText('GitHub'));
  await fireEvent.input(screen.getByLabelText('Name'), { target: { value: 'test' } });
  await fireEvent.input(screen.getByLabelText('Token'), { target: { value: 'val' } });

  await fireEvent.click(screen.getByRole('button', { name: 'Add Secret' }));

  await waitFor(() => {
    expect(screen.getByText('Storage unavailable')).toBeInTheDocument();
  });
});

test('injection settings section can be collapsed and expanded', async () => {
  render(SecretVaultCreate);

  await waitFor(() => {
    expect(screen.getByLabelText('Other')).toBeInTheDocument();
  });

  expect(screen.getByLabelText('Path pattern')).toBeInTheDocument();

  await fireEvent.click(screen.getByText('Injection settings'));

  expect(screen.queryByLabelText('Path pattern')).not.toBeInTheDocument();

  await fireEvent.click(screen.getByText('Injection settings'));

  expect(screen.getByLabelText('Path pattern')).toBeInTheDocument();
});

test('still renders form when listSecretServices fails', async () => {
  vi.mocked(window.listSecretServices).mockRejectedValueOnce(new Error('CLI not found'));

  render(SecretVaultCreate);

  await waitFor(() => {
    expect(screen.getByLabelText('Other')).toBeInTheDocument();
  });

  expect(screen.getByText('Other Secret')).toBeInTheDocument();
  expect(screen.getByLabelText('Name')).toBeInTheDocument();
});

test('Add Secret button is disabled when required credentials are empty for predefined type', async () => {
  render(SecretVaultCreate);

  await waitFor(() => {
    expect(screen.getByLabelText('GitHub')).toBeInTheDocument();
  });

  await fireEvent.click(screen.getByLabelText('GitHub'));
  await fireEvent.input(screen.getByLabelText('Name'), { target: { value: 'gh-token' } });

  expect(screen.getByRole('button', { name: 'Add Secret' })).toBeDisabled();
});

test('credentials reset when switching between service types', async () => {
  render(SecretVaultCreate);

  await waitFor(() => {
    expect(screen.getByLabelText('GitHub')).toBeInTheDocument();
  });

  await fireEvent.click(screen.getByLabelText('GitHub'));
  await fireEvent.input(screen.getByLabelText('Token'), { target: { value: 'ghp_abc123' } });

  await fireEvent.click(screen.getByLabelText('Gemini'));

  expect(screen.getByLabelText('Api Key')).toHaveValue('');
});

test('filters out profiles without credentials from type options', async () => {
  const services: OpenshellProfile[] = [
    {
      id: 'has-creds',
      display_name: 'With Creds',
      credentials: [{ name: 'key', required: true }],
    },
    {
      id: 'no-creds',
      display_name: 'No Creds',
    },
    {
      id: 'empty-creds',
      display_name: 'Empty Creds',
      credentials: [],
    },
  ];
  vi.mocked(window.listSecretServices).mockResolvedValue(services);

  render(SecretVaultCreate);

  await waitFor(() => {
    expect(screen.getByLabelText('With Creds')).toBeInTheDocument();
  });

  expect(screen.queryByLabelText('No Creds')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Empty Creds')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Other')).toBeInTheDocument();
});

test('uses credential name as fallback key when env_vars is empty', async () => {
  const services: OpenshellProfile[] = [
    {
      id: 'custom-provider',
      display_name: 'Custom',
      credentials: [{ name: 'secret_key', required: true }],
    },
  ];
  vi.mocked(window.listSecretServices).mockResolvedValue(services);

  render(SecretVaultCreate);

  await waitFor(() => {
    expect(screen.getByLabelText('Custom')).toBeInTheDocument();
  });

  await fireEvent.click(screen.getByLabelText('Custom'));
  await fireEvent.input(screen.getByLabelText('Name'), { target: { value: 'my-custom' } });
  await fireEvent.input(screen.getByLabelText('Secret Key'), { target: { value: 'sk-123' } });

  await fireEvent.click(screen.getByRole('button', { name: 'Add Secret' }));

  expect(window.createSecret).toHaveBeenCalledWith({
    name: 'my-custom',
    type: 'custom-provider',
    value: {
      credentials: {
        secret_key: 'sk-123',
      },
    },
  });
});
