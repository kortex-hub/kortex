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

import { faRobot } from '@fortawesome/free-solid-svg-icons';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { expect, test, vi } from 'vitest';

import type { AgentWorkspaceSummaryUI } from '/@/stores/agent-workspaces.svelte';

import AgentWorkspaceName from './AgentWorkspaceName.svelte';

vi.mock('/@/lib/guided-setup/agent-registry', () => ({
  getAgentDefinition: vi.fn(() => ({
    title: 'Test Agent',
    icon: faRobot,
    colorClass: 'bg-blue-500',
  })),
}));

vi.mock('tinro', () => ({
  router: {
    goto: vi.fn(),
  },
}));

test('Button has correct classes', async () => {
  const workspace: AgentWorkspaceSummaryUI = {
    id: 'test-workspace-id',
    name: 'Test Workspace Name',
    agent: 'claude',
  } as AgentWorkspaceSummaryUI;

  render(AgentWorkspaceName, {
    object: workspace,
  });

  const button = screen.getByRole('button');
  expect(button).toBeInTheDocument();
  expect(button).toHaveClass('flex');
  expect(button).toHaveClass('items-start');
});

test('Clicking button navigates to workspace overview', async () => {
  const { router } = await import('tinro');

  const workspace: AgentWorkspaceSummaryUI = {
    id: 'test-workspace-id',
    name: 'Test Workspace Name',
    agent: 'claude',
  } as AgentWorkspaceSummaryUI;

  render(AgentWorkspaceName, {
    object: workspace,
  });

  const button = screen.getByRole('button');
  await fireEvent.click(button);

  expect(router.goto).toHaveBeenCalledWith('/agent-workspaces/test-workspace-id/overview');
});
