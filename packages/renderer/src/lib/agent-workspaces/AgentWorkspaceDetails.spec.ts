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

import { render, screen, waitFor } from '@testing-library/svelte';
import { writable } from 'svelte/store';
import { beforeEach, expect, test, vi } from 'vitest';

import type { AgentWorkspaceConfiguration } from '/@api/agent-workspace-info';

import AgentWorkspaceDetails from './AgentWorkspaceDetails.svelte';

vi.mock('tinro', () => ({
  router: {
    ...writable({ path: '/agent-workspaces/ws-1/summary' }),
    goto: vi.fn(),
  },
}));

const configuration: AgentWorkspaceConfiguration = {
  name: 'api-refactor',
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.mocked(window.getAgentWorkspaceConfiguration).mockResolvedValue(configuration);
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
