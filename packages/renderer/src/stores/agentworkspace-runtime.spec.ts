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
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { agentWorkspaceRuntime } from './agentworkspace-runtime';
import { configurationProperties } from './configurationProperties';

const getConfigurationValueMock = vi.fn();

beforeEach(() => {
  vi.resetAllMocks();
  Object.defineProperty(window, 'getConfigurationValue', { value: getConfigurationValueMock });
  agentWorkspaceRuntime.set('podman');
});

afterEach(() => {
  agentWorkspaceRuntime.set('podman');
});

test('agentWorkspaceRuntime is default before config loads', () => {
  expect(get(agentWorkspaceRuntime)).toBe('podman');
});

test('agentWorkspaceRuntime set to configured value', async () => {
  getConfigurationValueMock.mockResolvedValue('openshell');

  configurationProperties.set([]);

  await vi.waitFor(() => expect(get(agentWorkspaceRuntime)).toBe('openshell'));
});

test('agentWorkspaceRuntime defaults to podman when config value is undefined', async () => {
  getConfigurationValueMock.mockResolvedValue(undefined);

  configurationProperties.set([]);

  await vi.waitFor(() => expect(get(agentWorkspaceRuntime)).toBe('podman'));
});

test('agentWorkspaceRuntime defaults to podman when config value is empty string', async () => {
  getConfigurationValueMock.mockResolvedValue('');

  configurationProperties.set([]);

  await vi.waitFor(() => expect(get(agentWorkspaceRuntime)).toBe('podman'));
});

test('agentWorkspaceRuntime ignores stale configuration reads', async () => {
  let resolveFirst: (value: string) => void = () => {};
  const firstRead = new Promise<string>(resolve => {
    resolveFirst = resolve;
  });

  getConfigurationValueMock.mockReturnValueOnce(firstRead).mockResolvedValueOnce('openshell');

  configurationProperties.set([]);
  configurationProperties.set([]);

  await vi.waitFor(() => expect(get(agentWorkspaceRuntime)).toBe('openshell'));

  resolveFirst('podman');
  await Promise.resolve();

  expect(get(agentWorkspaceRuntime)).toBe('openshell');
});
