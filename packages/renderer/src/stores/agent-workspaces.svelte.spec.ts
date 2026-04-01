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

import { beforeEach, expect, test, vi } from 'vitest';

import { agentWorkspaceStatuses, startAgentWorkspace, stopAgentWorkspace } from './agent-workspaces.svelte';

beforeEach(() => {
  vi.resetAllMocks();
  agentWorkspaceStatuses.clear();
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

test('startAgentWorkspace should revert to stopped on failure and re-throw', async () => {
  vi.mocked(window.startAgentWorkspace).mockRejectedValue(new Error('start failed'));

  await expect(startAgentWorkspace('ws-1')).rejects.toThrow('start failed');

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

test('stopAgentWorkspace should revert to running on failure and re-throw', async () => {
  agentWorkspaceStatuses.set('ws-1', 'running');
  vi.mocked(window.stopAgentWorkspace).mockRejectedValue(new Error('stop failed'));

  await expect(stopAgentWorkspace('ws-1')).rejects.toThrow('stop failed');

  expect(agentWorkspaceStatuses.get('ws-1')).toBe('running');
});
