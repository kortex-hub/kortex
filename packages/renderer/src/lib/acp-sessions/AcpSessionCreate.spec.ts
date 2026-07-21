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
import userEvent from '@testing-library/user-event';
import { writable } from 'svelte/store';
import { beforeEach, expect, test, vi } from 'vitest';

import * as agentsStore from '/@/stores/agents';
import type { SandboxInfoWithGateway } from '/@/stores/openshell-sandboxes';
import * as openshellSandboxesStore from '/@/stores/openshell-sandboxes';
import type { AgentInfo } from '/@api/agent-info';
import { AGENT_LABEL } from '/@api/openshell-gateway-info';

import AcpSessionCreate from './AcpSessionCreate.svelte';

vi.mock(import('/@/stores/openshell-sandboxes'));
vi.mock(import('/@/stores/agents'));
vi.mock(import('tinro'));

const ACP_AGENT: AgentInfo = {
  id: 'openclaw',
  name: 'OpenClaw',
  description: 'An ACP agent',
  command: 'openclaw',
  acp: { args: ['acp'] },
  destinationSkillsFolder: '/skills',
};

const NON_ACP_AGENT: AgentInfo = {
  id: 'claude',
  name: 'Claude Code',
  description: 'No ACP support',
  command: 'claude',
  destinationSkillsFolder: '/skills',
};

const SANDBOX_WITH_LABEL: SandboxInfoWithGateway = {
  id: 'sb-1',
  name: 'labeled-sandbox',
  phase: 'Ready',
  labels: { [AGENT_LABEL]: 'openclaw' },
  gatewayName: 'test-gateway',
};

const SANDBOX_WITHOUT_LABEL: SandboxInfoWithGateway = {
  id: 'sb-2',
  name: 'plain-sandbox',
  phase: 'Ready',
  gatewayName: 'test-gateway',
};

const SANDBOX_WITH_NON_ACP_AGENT: SandboxInfoWithGateway = {
  id: 'sb-3',
  name: 'non-acp-sandbox',
  phase: 'Ready',
  labels: { [AGENT_LABEL]: 'claude' },
  gatewayName: 'test-gateway',
};

const SANDBOX_WITH_UNKNOWN_AGENT: SandboxInfoWithGateway = {
  id: 'sb-4',
  name: 'unknown-agent-sandbox',
  phase: 'Ready',
  labels: { [AGENT_LABEL]: 'nonexistent-agent' },
  gatewayName: 'test-gateway',
};

beforeEach(() => {
  vi.resetAllMocks();
});

test('shows agent dropdown when sandbox has no kaiden.agent label', () => {
  vi.mocked(openshellSandboxesStore).allOpenshellSandboxes = writable<SandboxInfoWithGateway[]>([
    SANDBOX_WITHOUT_LABEL,
  ]);
  vi.mocked(agentsStore).agentInfos = writable<AgentInfo[]>([ACP_AGENT, NON_ACP_AGENT]);

  render(AcpSessionCreate, { onclose: vi.fn() });

  const agentDropdown = screen.getByLabelText('Agent');
  expect(agentDropdown).toBeInTheDocument();
});

test('shows agent name from label when sandbox has kaiden.agent label', () => {
  vi.mocked(openshellSandboxesStore).allOpenshellSandboxes = writable<SandboxInfoWithGateway[]>([SANDBOX_WITH_LABEL]);
  vi.mocked(agentsStore).agentInfos = writable<AgentInfo[]>([ACP_AGENT, NON_ACP_AGENT]);

  render(AcpSessionCreate, { onclose: vi.fn() });

  expect(screen.getByText('OpenClaw')).toBeInTheDocument();
  expect(screen.getByText('(set by workspace)')).toBeInTheDocument();
});

test('only shows ACP-capable agents in dropdown', () => {
  vi.mocked(openshellSandboxesStore).allOpenshellSandboxes = writable<SandboxInfoWithGateway[]>([
    SANDBOX_WITHOUT_LABEL,
  ]);
  vi.mocked(agentsStore).agentInfos = writable<AgentInfo[]>([ACP_AGENT, NON_ACP_AGENT]);

  render(AcpSessionCreate, { onclose: vi.fn() });

  expect(screen.queryByText('OpenClaw')).toBeInTheDocument();
  expect(screen.queryByText('Claude Code')).not.toBeInTheDocument();
});

test('shows warning and disables button when sandbox agent does not support ACP', async () => {
  vi.mocked(openshellSandboxesStore).allOpenshellSandboxes = writable<SandboxInfoWithGateway[]>([
    SANDBOX_WITH_NON_ACP_AGENT,
  ]);
  vi.mocked(agentsStore).agentInfos = writable<AgentInfo[]>([ACP_AGENT, NON_ACP_AGENT]);

  render(AcpSessionCreate, { onclose: vi.fn() });

  expect(screen.getByText('Claude Code')).toBeInTheDocument();
  expect(screen.getByText('(set by workspace)')).toBeInTheDocument();
  expect(screen.getByText(/does not support ACP sessions/)).toBeInTheDocument();

  const promptInput = screen.getByPlaceholderText("Describe what you'd like the agent to do...");
  await userEvent.type(promptInput, 'test prompt');

  const startButton = screen.getByRole('button', { name: 'Start Session' });
  expect(startButton).toBeDisabled();
});

test('shows warning when sandbox label points to unknown agent', async () => {
  vi.mocked(openshellSandboxesStore).allOpenshellSandboxes = writable<SandboxInfoWithGateway[]>([
    SANDBOX_WITH_UNKNOWN_AGENT,
  ]);
  vi.mocked(agentsStore).agentInfos = writable<AgentInfo[]>([ACP_AGENT, NON_ACP_AGENT]);

  render(AcpSessionCreate, { onclose: vi.fn() });

  expect(screen.getByText('nonexistent-agent')).toBeInTheDocument();
  expect(screen.getByText('(set by workspace)')).toBeInTheDocument();
  expect(screen.getByText(/does not support ACP sessions/)).toBeInTheDocument();

  const promptInput = screen.getByPlaceholderText("Describe what you'd like the agent to do...");
  await userEvent.type(promptInput, 'test prompt');

  const startButton = screen.getByRole('button', { name: 'Start Session' });
  expect(startButton).toBeDisabled();
});
