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

import { get } from 'svelte/store';
import { beforeEach, expect, test, vi } from 'vitest';

const receiveMock = vi.fn();

Object.defineProperty(window, 'events', {
  value: { receive: receiveMock },
  configurable: true,
});

const { agentWorkspaces, agentWorkspaceStatuses, fetchAgentWorkspaces, startAgentWorkspace, stopAgentWorkspace } =
  await import('./agent-workspaces.svelte');

// Capture subscription calls before beforeEach resets mock state
const receiveCallsAtLoad = [...receiveMock.mock.calls];

beforeEach(() => {
  vi.resetAllMocks();
  agentWorkspaceStatuses.clear();
  agentWorkspaces.set([]);
});

test('fetchAgentWorkspaces should call window.listAgentWorkspaces and update the store', async () => {
  const workspaces = [
    { id: 'ws-1', name: 'workspace-1', paths: { source: '/tmp/ws1', configuration: '/tmp/ws1/.kortex.yaml' } },
    { id: 'ws-2', name: 'workspace-2', paths: { source: '/tmp/ws2', configuration: '/tmp/ws2/.kortex.yaml' } },
  ];
  vi.mocked(window.listAgentWorkspaces).mockResolvedValue(workspaces);

  await fetchAgentWorkspaces();

  expect(window.listAgentWorkspaces).toHaveBeenCalled();
  expect(get(agentWorkspaces)).toEqual(workspaces);
});

test('should subscribe to agent-workspace-update event', () => {
  const subscribeCall = receiveCallsAtLoad.find((c: unknown[]) => c[0] === 'agent-workspace-update');
  expect(subscribeCall).toBeDefined();
  expect(subscribeCall![1]).toEqual(expect.any(Function));
});

test('agent-workspace-update event should trigger fetchAgentWorkspaces', async () => {
  const workspaces = [
    { id: 'ws-1', name: 'workspace-1', paths: { source: '/tmp/ws1', configuration: '/tmp/ws1/.kortex.yaml' } },
  ];
  vi.mocked(window.listAgentWorkspaces).mockResolvedValue(workspaces);

  const subscribeCall = receiveCallsAtLoad.find((c: unknown[]) => c[0] === 'agent-workspace-update');
  expect(subscribeCall).toBeDefined();

  const callback = subscribeCall![1] as () => void;
  callback();

  await vi.waitFor(() => {
    expect(get(agentWorkspaces)).toEqual(workspaces);
  });
});

test('startAgentWorkspace should transition status from stopped to running', async () => {
  vi.mocked(window.startAgentWorkspace).mockResolvedValue({ id: 'ws-1' });

  await startAgentWorkspace('ws-1');

  expect(window.startAgentWorkspace).toHaveBeenCalledWith('ws-1');
  expect(agentWorkspaceStatuses.get('ws-1')).toBe('running');
});

test('startAgentWorkspace should set starting status during the call', async () => {
  let resolveStart: (value: { id: string }) => void = () => {};
  vi.mocked(window.startAgentWorkspace).mockReturnValue(
    new Promise(resolve => {
      resolveStart = resolve;
    }),
  );

  const promise = startAgentWorkspace('ws-1');

  expect(agentWorkspaceStatuses.get('ws-1')).toBe('starting');

  resolveStart({ id: 'ws-1' });
  await promise;

  expect(agentWorkspaceStatuses.get('ws-1')).toBe('running');
});

test('startAgentWorkspace should revert to stopped on failure', async () => {
  vi.mocked(window.startAgentWorkspace).mockRejectedValue(new Error('start failed'));

  await startAgentWorkspace('ws-1');

  expect(agentWorkspaceStatuses.get('ws-1')).toBe('stopped');
});

test('stopAgentWorkspace should transition status from running to stopped', async () => {
  agentWorkspaceStatuses.set('ws-1', 'running');
  vi.mocked(window.stopAgentWorkspace).mockResolvedValue({ id: 'ws-1' });

  await stopAgentWorkspace('ws-1');

  expect(window.stopAgentWorkspace).toHaveBeenCalledWith('ws-1');
  expect(agentWorkspaceStatuses.get('ws-1')).toBe('stopped');
});

test('stopAgentWorkspace should set stopping status during the call', async () => {
  agentWorkspaceStatuses.set('ws-1', 'running');

  let resolveStop: (value: { id: string }) => void = () => {};
  vi.mocked(window.stopAgentWorkspace).mockReturnValue(
    new Promise(resolve => {
      resolveStop = resolve;
    }),
  );

  const promise = stopAgentWorkspace('ws-1');

  expect(agentWorkspaceStatuses.get('ws-1')).toBe('stopping');

  resolveStop({ id: 'ws-1' });
  await promise;

  expect(agentWorkspaceStatuses.get('ws-1')).toBe('stopped');
});

test('stopAgentWorkspace should revert to running on failure', async () => {
  agentWorkspaceStatuses.set('ws-1', 'running');
  vi.mocked(window.stopAgentWorkspace).mockRejectedValue(new Error('stop failed'));

  await stopAgentWorkspace('ws-1');

  expect(agentWorkspaceStatuses.get('ws-1')).toBe('running');
});
