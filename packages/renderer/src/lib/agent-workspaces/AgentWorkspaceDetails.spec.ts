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
import { get, writable } from 'svelte/store';
import { router } from 'tinro';
import { beforeEach, expect, test, vi } from 'vitest';

import { agentWorkspaceStatuses } from '/@/stores/agent-workspaces';
import type { AgentWorkspaceConfiguration } from '/@api/agent-workspace-info';

import AgentWorkspaceDetails from './AgentWorkspaceDetails.svelte';

vi.mock(import('tinro'));

const routerStore = writable({
  path: '/agent-workspaces/ws-1/summary',
  url: '/agent-workspaces/ws-1/summary',
  from: '/',
  query: {} as Record<string, string>,
  hash: '',
});

const configuration: AgentWorkspaceConfiguration = {
  name: 'api-refactor',
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.mocked(router).subscribe.mockImplementation(routerStore.subscribe);
  vi.mocked(window.getAgentWorkspaceConfiguration).mockResolvedValue(configuration);
  vi.mocked(window.startAgentWorkspace).mockResolvedValue({ id: 'ws-1' });
  vi.mocked(window.stopAgentWorkspace).mockResolvedValue({ id: 'ws-1' });
  agentWorkspaceStatuses.set(new Map());
});

test('Expect page title to use configuration name', async () => {
  render(AgentWorkspaceDetails, { workspaceId: 'ws-1' });

  await waitFor(() => {
    expect(screen.getByText('api-refactor')).toBeInTheDocument();
  });
});

test('Expect getAgentWorkspaceConfiguration called with workspace id', () => {
  render(AgentWorkspaceDetails, { workspaceId: 'ws-1' });

  expect(window.getAgentWorkspaceConfiguration).toHaveBeenCalledWith('ws-1');
});

test('Expect Summary tab is present', async () => {
  render(AgentWorkspaceDetails, { workspaceId: 'ws-1' });

  await waitFor(() => {
    expect(screen.getByText('Summary')).toBeInTheDocument();
  });
});

test('Expect error message displayed when configuration fetch fails', async () => {
  vi.mocked(window.getAgentWorkspaceConfiguration).mockRejectedValue(new Error('workspace not found'));

  render(AgentWorkspaceDetails, { workspaceId: 'ws-unknown' });

  await waitFor(() => {
    expect(screen.getByText('Error: workspace not found')).toBeInTheDocument();
  });
});

test('Expect start button is rendered when workspace is stopped', async () => {
  render(AgentWorkspaceDetails, { workspaceId: 'ws-1' });

  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'Start Workspace' })).toBeInTheDocument();
  });
});

test('Expect clicking start button transitions workspace to running', async () => {
  render(AgentWorkspaceDetails, { workspaceId: 'ws-1' });

  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'Start Workspace' })).toBeInTheDocument();
  });

  const startButton = screen.getByRole('button', { name: 'Start Workspace' });
  await fireEvent.click(startButton);

  await waitFor(() => {
    expect(get(agentWorkspaceStatuses).get('ws-1')).toBe('running');
  });
});

test('Expect stop button is rendered when workspace is running', async () => {
  agentWorkspaceStatuses.set(new Map([['ws-1', 'running']]));

  render(AgentWorkspaceDetails, { workspaceId: 'ws-1' });

  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'Stop Workspace' })).toBeInTheDocument();
  });
});

test('Expect clicking stop button transitions workspace to stopped', async () => {
  agentWorkspaceStatuses.set(new Map([['ws-1', 'running']]));

  render(AgentWorkspaceDetails, { workspaceId: 'ws-1' });

  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'Stop Workspace' })).toBeInTheDocument();
  });

  const stopButton = screen.getByRole('button', { name: 'Stop Workspace' });
  await fireEvent.click(stopButton);

  await waitFor(() => {
    expect(get(agentWorkspaceStatuses).get('ws-1')).toBe('stopped');
  });
});
