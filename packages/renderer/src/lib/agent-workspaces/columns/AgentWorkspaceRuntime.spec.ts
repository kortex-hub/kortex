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

import { render, screen } from '@testing-library/svelte';
import { beforeEach, expect, test, vi } from 'vitest';

import type { AgentWorkspaceSummaryUI } from '/@/stores/agent-workspaces.svelte';

import AgentWorkspaceRuntime from './AgentWorkspaceRuntime.svelte';

beforeEach(() => {
  vi.resetAllMocks();
});

function createWorkspace(runtime: string): AgentWorkspaceSummaryUI {
  return {
    id: 'ws-1',
    name: 'test-workspace',
    project: 'test-project',
    agent: 'claude',
    state: 'running',
    runtime,
    paths: { source: '/tmp/ws', configuration: '/tmp/ws/.kaiden' },
    timestamps: { created: 1700000000 },
    forwards: [],
  };
}

test('Expect runtime value is displayed', () => {
  render(AgentWorkspaceRuntime, { object: createWorkspace('podman') });

  expect(screen.getByText('podman')).toBeInTheDocument();
});
