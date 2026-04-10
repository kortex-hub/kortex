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

import type { AgentWorkspaceConfiguration, AgentWorkspaceSummary } from '/@api/agent-workspace-info';

import AgentWorkspaceDetailsSummary from './AgentWorkspaceDetailsSummary.svelte';

const workspaceSummary: AgentWorkspaceSummary = {
  id: 'ws-1',
  name: 'api-refactor',
  project: 'backend',
  agent: 'coder-v1',
  state: 'stopped',
  model: 'gpt-4o',
  paths: {
    source: '/home/user/projects/backend',
    configuration: '/home/user/.config/kaiden/workspaces/api-refactor.yaml',
  },
};

const configuration: AgentWorkspaceConfiguration = {
  mounts: [
    { host: '$SOURCES/../shared-lib', target: '/workspace/shared-lib', ro: false },
    { host: '$HOME/.gitconfig', target: '/workspace/.gitconfig', ro: true },
  ],
  environment: [
    { name: 'API_KEY', value: 'test-key' },
    { name: 'DB_PASSWORD', secret: 'prod-db-creds' },
  ],
};

beforeEach(() => {
  vi.resetAllMocks();
});

test('Expect project is displayed', () => {
  render(AgentWorkspaceDetailsSummary, { workspaceSummary, configuration });

  expect(screen.getByText('backend')).toBeInTheDocument();
});

test('Expect agent is displayed', () => {
  render(AgentWorkspaceDetailsSummary, { workspaceSummary, configuration });

  expect(screen.getByText('coder-v1')).toBeInTheDocument();
});

test('Expect state is displayed', () => {
  render(AgentWorkspaceDetailsSummary, { workspaceSummary, configuration });

  expect(screen.getByText('stopped')).toBeInTheDocument();
});

test('Expect model is displayed when present', () => {
  render(AgentWorkspaceDetailsSummary, { workspaceSummary, configuration });

  expect(screen.getByText('gpt-4o')).toBeInTheDocument();
});

test('Expect model is not displayed when absent', () => {
  const summaryWithoutModel: AgentWorkspaceSummary = { ...workspaceSummary, model: undefined };
  render(AgentWorkspaceDetailsSummary, {
    workspaceSummary: summaryWithoutModel,
    configuration,
  });

  expect(screen.queryByText('Model')).not.toBeInTheDocument();
});

test('Expect mounts are displayed with host and target', () => {
  render(AgentWorkspaceDetailsSummary, { workspaceSummary, configuration });

  expect(screen.getByText('$SOURCES/../shared-lib')).toBeInTheDocument();
  expect(screen.getByText('/workspace/shared-lib')).toBeInTheDocument();
});

test('Expect read-only mount shows indicator', () => {
  render(AgentWorkspaceDetailsSummary, { workspaceSummary, configuration });

  expect(screen.getByText('/workspace/.gitconfig (read-only)')).toBeInTheDocument();
});

test('Expect environment variable with value is displayed', () => {
  render(AgentWorkspaceDetailsSummary, { workspaceSummary, configuration });

  expect(screen.getByText('API_KEY')).toBeInTheDocument();
  expect(screen.getByText('test-key')).toBeInTheDocument();
});

test('Expect environment variable with secret is displayed', () => {
  render(AgentWorkspaceDetailsSummary, { workspaceSummary, configuration });

  expect(screen.getByText('DB_PASSWORD')).toBeInTheDocument();
  expect(screen.getByText('(secret: prod-db-creds)')).toBeInTheDocument();
});

test('Expect mounts section is hidden when configuration has no mounts', () => {
  render(AgentWorkspaceDetailsSummary, { workspaceSummary, configuration: {} });

  expect(screen.queryByText('Mounts')).not.toBeInTheDocument();
});

test('Expect environment section is hidden when configuration has no environment', () => {
  render(AgentWorkspaceDetailsSummary, { workspaceSummary, configuration: {} });

  expect(screen.queryByText('Environment')).not.toBeInTheDocument();
});

test('Expect workspace section heading is always displayed', () => {
  render(AgentWorkspaceDetailsSummary, { workspaceSummary: undefined, configuration: {} });

  expect(screen.getByText('Workspace')).toBeInTheDocument();
});
