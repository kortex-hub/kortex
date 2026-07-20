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

import { render, screen, within } from '@testing-library/svelte';
import { beforeEach, expect, test, vi } from 'vitest';

import { notificationQueue } from '/@/stores/notifications';
import { openshellSandboxes } from '/@/stores/openshell-sandboxes';
import type { NotificationCard } from '/@api/notification';
import type { GatewaySandboxes } from '/@api/openshell-gateway-info';

import AgentWorkspaceList from './AgentWorkspaceList.svelte';

beforeEach(() => {
  vi.resetAllMocks();
  openshellSandboxes.set([]);
  notificationQueue.set([]);
});

test('Expect empty screen when no workspaces', () => {
  render(AgentWorkspaceList);

  expect(screen.getByText('No agent workspaces')).toBeInTheDocument();
});

test('Expect stat cards show zero counts when empty', () => {
  render(AgentWorkspaceList);

  const activeCard = screen.getByText('Active Sessions').closest('div')!;
  const totalCard = screen.getByText('Total Sessions').closest('div')!;
  const agentsCard = screen.getByText('Configured Agents').closest('div')!;

  expect(within(activeCard).getByText('0')).toBeInTheDocument();
  expect(within(totalCard).getByText('0')).toBeInTheDocument();
  expect(within(agentsCard).getByText('0')).toBeInTheDocument();
});

test('Expect stat cards show correct counts with workspaces', () => {
  const workspaces: GatewaySandboxes[] = [
    {
      gateway: {
        name: 'kaiden',
        endpoint: 'http://localhost:18080',
      },
      sandboxes: [
        {
          id: 'ws-1',
          name: 'api-refactor',
          phase: 'Unknown',
          sourcePath: '/home/user/projects/backend',
          created_at: Date.now().toString(),
        },
      ],
    },
    {
      gateway: {
        name: 'kaiden',
        endpoint: 'http://localhost:18080',
      },
      sandboxes: [
        {
          id: 'ws-2',
          name: 'frontend-redesign',
          phase: 'Ready',
          sourcePath: '/home/user/projects/frontend',
          created_at: Date.now().toString(),
        },
      ],
    },
  ];
  openshellSandboxes.set(workspaces);

  render(AgentWorkspaceList);

  expect(screen.getByText('api-refactor')).toBeInTheDocument();
  expect(screen.getByText('frontend-redesign')).toBeInTheDocument();
  const activeCard = screen.getByText('Active Sessions').closest('div')!;
  const totalCard = screen.getByText('Total Sessions').closest('div')!;
  const agentsCard = screen.getByText('Configured Agents').closest('div')!;

  expect(within(activeCard).getByText('1')).toBeInTheDocument();
  expect(within(totalCard).getByText('2')).toBeInTheDocument();
  expect(within(agentsCard).getByText('0')).toBeInTheDocument();
});

test('Expect page title to be Agentic Workspaces', () => {
  render(AgentWorkspaceList);

  expect(screen.getByText('Agentic Workspaces')).toBeInTheDocument();
});

test('Expect NotificationsBox to be hidden when there are no notifications', () => {
  render(AgentWorkspaceList);

  const notificationsBox = screen.queryByLabelText('Notifications Box');
  expect(notificationsBox).not.toBeInTheDocument();
});

test('Expect NotificationsBox to be visible when there are highlighted notifications', () => {
  const notification: NotificationCard = {
    id: 1,
    extensionId: 'extension',
    title: 'Test notification',
    body: 'Test body',
    type: 'info',
    highlight: true,
  };
  notificationQueue.set([notification]);

  render(AgentWorkspaceList);

  const notificationsBox = screen.queryByLabelText('Notifications Box');
  expect(notificationsBox).toBeInTheDocument();
});
