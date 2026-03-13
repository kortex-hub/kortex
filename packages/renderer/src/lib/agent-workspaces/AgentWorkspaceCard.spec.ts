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
import { beforeEach, expect, test, vi } from 'vitest';

import type { AgentWorkspaceSummary } from '/@api/agent-workspace-info';

import AgentWorkspaceCard from './AgentWorkspaceCard.svelte';

const workspace: AgentWorkspaceSummary = {
  id: 'ws-1',
  name: 'api-refactor',
  paths: {
    source: '/home/user/projects/backend',
    configuration: '/home/user/.config/kortex/workspaces/api-refactor.yaml',
  },
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(window.showMessageBox).mockResolvedValue({ response: 1 });
  vi.mocked(window.removeAgentWorkspace).mockResolvedValue({ id: 'ws-1' });
  vi.mocked(window.listAgentWorkspaces).mockResolvedValue([]);
});

test('Expect card displays workspace name', () => {
  render(AgentWorkspaceCard, { workspace });

  expect(screen.getByText('api-refactor')).toBeInTheDocument();
});

test('Expect card displays source path', () => {
  render(AgentWorkspaceCard, { workspace });

  expect(screen.getByText('/home/user/projects/backend')).toBeInTheDocument();
});

test('Expect card displays configuration path', () => {
  render(AgentWorkspaceCard, { workspace });

  expect(screen.getByText('/home/user/.config/kortex/workspaces/api-refactor.yaml')).toBeInTheDocument();
});

test('Expect card has aria label with workspace name', () => {
  render(AgentWorkspaceCard, { workspace });

  expect(screen.getByRole('region', { name: 'workspace api-refactor' })).toBeInTheDocument();
});

test('Expect remove button is rendered', () => {
  render(AgentWorkspaceCard, { workspace });

  expect(screen.getByRole('button', { name: 'Remove workspace api-refactor' })).toBeInTheDocument();
});

test('Expect confirmation dialog shown when remove button clicked', async () => {
  render(AgentWorkspaceCard, { workspace });

  const removeButton = screen.getByRole('button', { name: 'Remove workspace api-refactor' });
  await fireEvent.click(removeButton);

  expect(window.showMessageBox).toHaveBeenCalledOnce();
});

test('Expect workspace removed when user confirms', async () => {
  vi.mocked(window.showMessageBox).mockResolvedValue({ response: 0 });

  render(AgentWorkspaceCard, { workspace });

  const removeButton = screen.getByRole('button', { name: 'Remove workspace api-refactor' });
  await fireEvent.click(removeButton);

  await vi.waitFor(() => {
    expect(window.removeAgentWorkspace).toHaveBeenCalledWith('ws-1');
  });
});

test('Expect workspace not removed when user cancels', async () => {
  vi.mocked(window.showMessageBox).mockResolvedValue({ response: 1 });

  render(AgentWorkspaceCard, { workspace });

  const removeButton = screen.getByRole('button', { name: 'Remove workspace api-refactor' });
  await fireEvent.click(removeButton);

  expect(window.removeAgentWorkspace).not.toHaveBeenCalled();
});
