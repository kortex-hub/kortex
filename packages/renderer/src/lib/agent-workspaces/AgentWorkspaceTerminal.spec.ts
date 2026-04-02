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
import { get, writable } from 'svelte/store';
import { router } from 'tinro';
import { beforeEach, expect, test, vi } from 'vitest';

import { agentWorkspaceTerminals } from '/@/stores/agent-workspace-terminal-store';
import { agentWorkspaceStatuses } from '/@/stores/agent-workspaces.svelte';

import AgentWorkspaceTerminal from './AgentWorkspaceTerminal.svelte';

vi.mock(import('tinro'));

const routerStore = writable({
  path: '/agent-workspaces/ws-1/terminal',
  url: '/agent-workspaces/ws-1/terminal',
  from: '/',
  query: {} as Record<string, string>,
  hash: '',
});

let shellInAgentWorkspaceMock = vi.fn();

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(router).subscribe.mockImplementation(routerStore.subscribe);
  vi.mocked(window.getConfigurationValue).mockImplementation(async (key: string) => {
    if (key === 'terminal.integrated.scrollback') {
      return 1000;
    }
    return undefined;
  });
  shellInAgentWorkspaceMock = vi.mocked(window.shellInAgentWorkspace);
  agentWorkspaceTerminals.set([]);
  agentWorkspaceStatuses.clear();
});

test('shows empty screen when workspace is not running', async () => {
  render(AgentWorkspaceTerminal, { workspaceId: 'ws-1', screenReaderMode: true });

  await waitFor(() => {
    expect(screen.getByText('Workspace is not running')).toBeInTheDocument();
  });
});

test('calls shellInAgentWorkspace when workspace is running', async () => {
  agentWorkspaceStatuses.set('ws-1', 'running');

  const sendCallbackId = 42;
  shellInAgentWorkspaceMock.mockResolvedValue(sendCallbackId);

  render(AgentWorkspaceTerminal, { workspaceId: 'ws-1', screenReaderMode: true });

  await waitFor(() => expect(shellInAgentWorkspaceMock).toHaveBeenCalled());
  expect(shellInAgentWorkspaceMock).toHaveBeenCalledWith(
    'ws-1',
    expect.any(Function),
    expect.any(Function),
    expect.any(Function),
  );
});

test('writes received data to xterm terminal', async () => {
  agentWorkspaceStatuses.set('ws-1', 'running');

  let onDataCallback: (data: string) => void = () => {};
  const sendCallbackId = 42;
  shellInAgentWorkspaceMock.mockImplementation(
    async (_id: string, onData: (data: string) => void, _onError: (error: string) => void, _onEnd: () => void) => {
      onDataCallback = onData;
      return sendCallbackId;
    },
  );

  const renderObject = render(AgentWorkspaceTerminal, { workspaceId: 'ws-1', screenReaderMode: true });

  await waitFor(() => expect(shellInAgentWorkspaceMock).toHaveBeenCalled());

  onDataCallback('hello\nworld');

  await waitFor(() => {
    const liveRegion = renderObject.container.querySelector('div[aria-live="assertive"]');
    expect(liveRegion).toHaveTextContent('hello world');
  });
});

test('serializes terminal buffer to store on unmount', async () => {
  agentWorkspaceStatuses.set('ws-1', 'running');

  let onDataCallback: (data: string) => void = () => {};
  const sendCallbackId = 42;
  shellInAgentWorkspaceMock.mockImplementation(
    async (_id: string, onData: (data: string) => void, _onError: (error: string) => void, _onEnd: () => void) => {
      onDataCallback = onData;
      return sendCallbackId;
    },
  );

  const renderObject = render(AgentWorkspaceTerminal, { workspaceId: 'ws-1', screenReaderMode: true });

  await waitFor(() => expect(shellInAgentWorkspaceMock).toHaveBeenCalled());

  onDataCallback('test output');

  expect(get(agentWorkspaceTerminals)).toHaveLength(0);

  renderObject.unmount();

  const terminals = get(agentWorkspaceTerminals);
  expect(terminals).toHaveLength(1);
  expect(terminals[0]?.workspaceId).toBe('ws-1');
});
