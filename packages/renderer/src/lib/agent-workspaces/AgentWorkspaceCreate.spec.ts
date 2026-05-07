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
import userEvent from '@testing-library/user-event';
import { writable } from 'svelte/store';
import { beforeEach, expect, test, vi } from 'vitest';

import * as agentWorkspaceRuntimeStore from '/@/stores/agentworkspace-runtime';
import * as mcpStore from '/@/stores/mcp-remote-servers';
import * as modelCatalogStore from '/@/stores/model-catalog';
import * as providerStore from '/@/stores/providers';
import * as ragStore from '/@/stores/rag-environments';
import * as secretVaultStore from '/@/stores/secret-vault';
import * as skillsStore from '/@/stores/skills';
import type { MCPRemoteServerInfo } from '/@api/mcp/mcp-server-info';
import type { ProviderInfo } from '/@api/provider-info';
import type { RagEnvironment } from '/@api/rag/rag-environment';
import type { SecretVaultInfo } from '/@api/secret-vault/secret-vault-info';
import type { SkillInfo } from '/@api/skill/skill-info';

import AgentWorkspaceCreate from './AgentWorkspaceCreate.svelte';

vi.mock(import('/@/navigation'));
vi.mock(import('/@/stores/agentworkspace-runtime'));
vi.mock(import('/@/stores/skills'));
vi.mock(import('/@/stores/mcp-remote-servers'));
vi.mock(import('/@/stores/secret-vault'));
vi.mock(import('/@/stores/providers'));
vi.mock(import('/@/stores/rag-environments'));
vi.mock(import('/@/stores/model-catalog'));

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers({ shouldAdvanceTime: true });
  HTMLElement.prototype.animate = vi.fn().mockReturnValue({
    finished: Promise.resolve(),
    cancel: vi.fn(),
    onfinish: null,
  });
  vi.mocked(agentWorkspaceRuntimeStore).agentWorkspaceRuntime = writable<string>('podman');
  vi.mocked(skillsStore).skillInfos = writable<SkillInfo[]>([]);
  vi.mocked(mcpStore).mcpRemoteServerInfos = writable<MCPRemoteServerInfo[]>([]);
  vi.mocked(secretVaultStore).secretVaultInfos = writable<readonly SecretVaultInfo[]>([]);
  vi.mocked(providerStore).providerInfos = writable<ProviderInfo[]>([]);
  vi.mocked(ragStore).ragEnvironments = writable<RagEnvironment[]>([]);
  vi.mocked(modelCatalogStore).disabledModels = writable<Set<string>>(new Set());
  vi.mocked(modelCatalogStore.isModelEnabled).mockImplementation(
    (disabled: Set<string>, providerId: string, label: string): boolean => !disabled.has(`${providerId}::${label}`),
  );
  vi.mocked(modelCatalogStore.modelKey).mockImplementation(
    (providerId: string, label: string): string => `${providerId}::${label}`,
  );
});

test('Expect page title displayed', () => {
  render(AgentWorkspaceCreate);

  expect(screen.getByText('Create Coding Agent Workspace')).toBeInTheDocument();
});

test('Expect wizard stepper rendered with all five step labels', () => {
  render(AgentWorkspaceCreate);

  expect(screen.getByRole('navigation', { name: 'Wizard progress' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Workspace step' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Agent & Model step' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Tools & Secrets step' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'File System step' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Networking step' })).toBeInTheDocument();
});

test('Expect workspace step content shown on initial render', () => {
  render(AgentWorkspaceCreate);

  expect(screen.getByRole('heading', { name: 'Workspace' })).toBeInTheDocument();
  expect(screen.getByText(/Point to a local project folder/)).toBeInTheDocument();
});

test('Expect source input rendered with correct placeholder', () => {
  render(AgentWorkspaceCreate);

  expect(screen.getByPlaceholderText('/path/to/project')).toBeInTheDocument();
});

test('Expect workspace name input rendered', () => {
  render(AgentWorkspaceCreate);

  expect(screen.getByPlaceholderText('e.g., Frontend Refactoring')).toBeInTheDocument();
});

test('Expect description section is collapsed by default', () => {
  render(AgentWorkspaceCreate);

  expect(screen.queryByPlaceholderText('Short note for your team (optional)')).not.toBeInTheDocument();
});

test('Expect description section expands when toggle clicked', async () => {
  render(AgentWorkspaceCreate);

  await fireEvent.click(screen.getByRole('button', { name: /Description/ }));

  expect(screen.getByPlaceholderText('Short note for your team (optional)')).toBeInTheDocument();
});

test('Expect workspace name auto-suggested from source path', async () => {
  render(AgentWorkspaceCreate);

  await fireEvent.input(screen.getByPlaceholderText('/path/to/project'), {
    target: { value: '/home/user/my-project' },
  });

  expect((screen.getByPlaceholderText('e.g., Frontend Refactoring') as HTMLInputElement).value).toBe('my-project');
});

test('Expect Continue button rendered on step 1', () => {
  render(AgentWorkspaceCreate);

  expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
});

test('Expect Continue button disabled when source is empty', () => {
  render(AgentWorkspaceCreate);

  expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
});

test('Expect Continue button enabled when name and source are filled', async () => {
  render(AgentWorkspaceCreate);

  await fireEvent.input(screen.getByPlaceholderText('/path/to/project'), {
    target: { value: '/home/user/my-repo' },
  });

  expect(screen.getByRole('button', { name: 'Continue' })).not.toBeDisabled();
});

test('Expect use-all-defaults button on step 1', async () => {
  render(AgentWorkspaceCreate);

  await fireEvent.input(screen.getByPlaceholderText('/path/to/project'), {
    target: { value: '/home/user/my-repo' },
  });

  expect(screen.getByRole('button', { name: 'Use all defaults and create workspace' })).not.toBeDisabled();
});

test('Expect use-all-defaults button disabled on step 1 when source is empty', () => {
  render(AgentWorkspaceCreate);

  expect(screen.getByRole('button', { name: 'Use all defaults and create workspace' })).toBeDisabled();
});

test('Expect Cancel button always visible', () => {
  render(AgentWorkspaceCreate);

  expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
});

test('Expect Back button not visible on first step', () => {
  render(AgentWorkspaceCreate);

  expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument();
});

test('Expect sandbox security message displayed with step counter', () => {
  render(AgentWorkspaceCreate);

  expect(screen.getByText(/Step 1 of 5 · Workspace will run in a secured sandbox environment/)).toBeInTheDocument();
});

test('Expect navigating to agent & model step shows coding agent options', async () => {
  render(AgentWorkspaceCreate);

  await fireEvent.input(screen.getByPlaceholderText('/path/to/project'), {
    target: { value: '/home/user/my-repo' },
  });
  await fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

  expect(screen.getAllByText('Coding Agent').length).toBeGreaterThanOrEqual(1);
  expect(screen.getByText('Claude Code')).toBeInTheDocument();
  expect(screen.getByText('Goose')).toBeInTheDocument();
  expect(screen.getAllByText('OpenCode').length).toBeGreaterThanOrEqual(1);
  expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
});

test('Expect Start Workspace button visible on last step', async () => {
  render(AgentWorkspaceCreate);

  await fireEvent.input(screen.getByPlaceholderText('/path/to/project'), {
    target: { value: '/home/user/my-repo' },
  });

  for (let i = 0; i < wizardStepCount - 1; i++) {
    await fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  }

  expect(screen.getByRole('button', { name: 'Start Workspace' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Continue' })).not.toBeInTheDocument();
});

test('Expect custom paths section shown when Custom Paths selected on filesystem step', async () => {
  render(AgentWorkspaceCreate);

  await fireEvent.input(screen.getByPlaceholderText('/path/to/project'), {
    target: { value: '/home/user/my-repo' },
  });
  // Workspace → Agent & Model → Tools & Secrets → File System
  await fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  await fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  await fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

  await fireEvent.click(screen.getByRole('radio', { name: 'Use Custom Paths' }));

  expect(screen.getByPlaceholderText('/path/to/allowed/directory')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Add Another Path' })).toBeInTheDocument();
});

async function navigateToToolsSecretsStep(): Promise<void> {
  await fireEvent.input(screen.getByPlaceholderText('/path/to/project'), {
    target: { value: '/home/user/my-repo' },
  });
  // Workspace → Agent & Model → Tools & Secrets
  await fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  await fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
}

async function expandCustomize(): Promise<void> {
  await fireEvent.click(screen.getByRole('button', { name: /Customize skills, MCP servers, vault, and knowledges/ }));
}

test('Expect summary card and customize toggle on tools & secrets step', async () => {
  render(AgentWorkspaceCreate);

  await navigateToToolsSecretsStep();

  expect(screen.getByText(/Everything available is included/)).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: /Customize skills, MCP servers, vault, and knowledges/ }),
  ).toBeInTheDocument();
});

test('Expect secrets section visible after expanding customize', async () => {
  render(AgentWorkspaceCreate);

  await navigateToToolsSecretsStep();
  await expandCustomize();

  expect(screen.getByText('Secret Vault')).toBeInTheDocument();
  expect(screen.getByText('Select secrets from your vault to make available in the workspace')).toBeInTheDocument();
});

test('Expect secrets empty state shown when vault is empty', async () => {
  render(AgentWorkspaceCreate);

  await navigateToToolsSecretsStep();
  await expandCustomize();

  expect(screen.getByText('No secrets in your vault yet.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Open Vault' })).toBeInTheDocument();
});

test('Expect secrets listed when vault has entries', async () => {
  vi.mocked(secretVaultStore).secretVaultInfos = writable<readonly SecretVaultInfo[]>([
    {
      id: 'github-token',
      name: 'GitHub Token',
      type: 'github',
      description: 'Personal access token',
    },
    {
      id: 'anthropic-key',
      name: 'Anthropic Key',
      type: 'anthropic',
      description: 'API key',
    },
  ]);

  render(AgentWorkspaceCreate);

  await navigateToToolsSecretsStep();
  await expandCustomize();

  expect(screen.getByText('GitHub Token')).toBeInTheDocument();
  expect(screen.getByText('Anthropic Key')).toBeInTheDocument();
  expect(screen.getByText('Secret Vault')).toBeInTheDocument();
  expect(screen.queryByText('No secrets in your vault yet.')).not.toBeInTheDocument();
});

test('Expect Open Vault button navigates to secret vault', async () => {
  const { handleNavigation } = await import('/@/navigation');

  render(AgentWorkspaceCreate);

  await navigateToToolsSecretsStep();
  await expandCustomize();
  await fireEvent.click(screen.getByRole('button', { name: 'Open Vault' }));

  expect(handleNavigation).toHaveBeenCalledWith({ page: 'secret-vault' });
});

test('Expect skills section visible after expanding customize', async () => {
  render(AgentWorkspaceCreate);

  await navigateToToolsSecretsStep();
  await expandCustomize();

  expect(screen.getByText('Skills')).toBeInTheDocument();
  expect(screen.getByText('Select the capabilities your agent should have')).toBeInTheDocument();
});

test('Expect skills empty state shown when no skills available', async () => {
  render(AgentWorkspaceCreate);

  await navigateToToolsSecretsStep();
  await expandCustomize();

  expect(screen.getByText('No skills available yet.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Manage Skills' })).toBeInTheDocument();
});

test('Expect skills listed when store has entries', async () => {
  vi.mocked(skillsStore).skillInfos = writable<SkillInfo[]>([
    {
      name: 'kubernetes',
      description: 'Deploy & manage clusters',
      path: '/skills/kubernetes',
      enabled: true,
      managed: false,
    },
    {
      name: 'code-review',
      description: 'Analyze code quality & security',
      path: '/skills/code-review',
      enabled: true,
      managed: true,
    },
  ]);

  render(AgentWorkspaceCreate);

  await navigateToToolsSecretsStep();
  await expandCustomize();

  expect(screen.getByText('kubernetes')).toBeInTheDocument();
  expect(screen.getByText('code-review')).toBeInTheDocument();
  expect(screen.queryByText('No skills available yet.')).not.toBeInTheDocument();
});

test.each([
  { managed: false, expectedGroup: 'Pre-built', unexpectedGroup: 'Custom' },
  { managed: true, expectedGroup: 'Custom', unexpectedGroup: 'Pre-built' },
])('Expect managed=$managed maps to the correct group', async ({ managed, expectedGroup, unexpectedGroup }) => {
  vi.mocked(skillsStore).skillInfos = writable<SkillInfo[]>([
    {
      name: 'sample-skill',
      description: 'Sample description',
      path: '/skills/sample-skill',
      enabled: true,
      managed,
    },
  ]);

  render(AgentWorkspaceCreate);

  await navigateToToolsSecretsStep();
  await expandCustomize();

  expect(screen.getByText(expectedGroup)).toBeInTheDocument();
  expect(screen.queryByText(unexpectedGroup)).not.toBeInTheDocument();
});

test('Expect Manage Skills button navigates to skills page', async () => {
  const { handleNavigation } = await import('/@/navigation');

  render(AgentWorkspaceCreate);

  await navigateToToolsSecretsStep();
  await expandCustomize();
  await fireEvent.click(screen.getByRole('button', { name: 'Manage Skills' }));

  expect(handleNavigation).toHaveBeenCalledWith({ page: 'skills' });
});

test('Expect createAgentWorkspace called with skill paths', async () => {
  vi.mocked(skillsStore).skillInfos = writable<SkillInfo[]>([
    {
      name: 'kubernetes',
      description: 'Deploy & manage clusters',
      path: '/home/user/.kaiden/skills/kubernetes',
      enabled: true,
      managed: false,
    },
    {
      name: 'code-review',
      description: 'Analyze code quality',
      path: '/home/user/.kaiden/skills/code-review',
      enabled: true,
      managed: true,
    },
  ]);

  render(AgentWorkspaceCreate);

  await fireEvent.input(screen.getByPlaceholderText('/path/to/project'), {
    target: { value: '/home/user/my-repo' },
  });
  await fireEvent.click(screen.getByRole('button', { name: 'Use all defaults and create workspace' }));

  expect(window.createAgentWorkspace).toHaveBeenCalledWith(
    expect.objectContaining({
      skills: ['/home/user/.kaiden/skills/kubernetes', '/home/user/.kaiden/skills/code-review'],
    }),
  );
});

test('Expect createAgentWorkspace called without skills when none available', async () => {
  render(AgentWorkspaceCreate);

  await fireEvent.input(screen.getByPlaceholderText('/path/to/project'), {
    target: { value: '/home/user/my-repo' },
  });
  await fireEvent.click(screen.getByRole('button', { name: 'Use all defaults and create workspace' }));

  expect(window.createAgentWorkspace).toHaveBeenCalledWith(
    expect.objectContaining({
      skills: undefined,
    }),
  );
});

test('Expect createAgentWorkspace called with secret ids when vault has entries', async () => {
  vi.mocked(secretVaultStore).secretVaultInfos = writable<readonly SecretVaultInfo[]>([
    {
      id: 'github-token',
      name: 'GitHub Token',
      type: 'github',
      description: 'Personal access token',
    },
    {
      id: 'anthropic-key',
      name: 'Anthropic Key',
      type: 'anthropic',
      description: 'API key',
    },
  ]);

  render(AgentWorkspaceCreate);

  await fireEvent.input(screen.getByPlaceholderText('/path/to/project'), {
    target: { value: '/home/user/my-repo' },
  });
  await fireEvent.click(screen.getByRole('button', { name: 'Use all defaults and create workspace' }));

  expect(window.createAgentWorkspace).toHaveBeenCalledWith(
    expect.objectContaining({
      secrets: ['github-token', 'anthropic-key'],
    }),
  );
});

test('Expect createAgentWorkspace called without secrets when vault is empty', async () => {
  render(AgentWorkspaceCreate);

  await fireEvent.input(screen.getByPlaceholderText('/path/to/project'), {
    target: { value: '/home/user/my-repo' },
  });
  await fireEvent.click(screen.getByRole('button', { name: 'Use all defaults and create workspace' }));

  expect(window.createAgentWorkspace).toHaveBeenCalledWith(
    expect.objectContaining({
      secrets: undefined,
    }),
  );
});

test('Expect Knowledges section visible after expanding customize', async () => {
  render(AgentWorkspaceCreate);

  await navigateToToolsSecretsStep();
  await expandCustomize();

  expect(screen.getByText('Knowledges')).toBeInTheDocument();
  expect(screen.getByText('Optional retrieval context for the agent')).toBeInTheDocument();
});

test('Expect Knowledges empty state shown when no knowledge bases available', async () => {
  render(AgentWorkspaceCreate);

  await navigateToToolsSecretsStep();
  await expandCustomize();

  expect(screen.getByText('No knowledge bases available yet.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Manage Knowledges' })).toBeInTheDocument();
});

test('Expect knowledge bases listed with provider display name and source count', async () => {
  vi.mocked(providerStore).providerInfos = writable<ProviderInfo[]>([{ id: 'milvus', name: 'Milvus' } as ProviderInfo]);
  vi.mocked(ragStore).ragEnvironments = writable<RagEnvironment[]>([
    {
      name: 'kubernetes-knowledges',
      ragConnection: { name: 'my-connection', providerId: 'milvus' },
      chunkerId: 'docling',
      mcpServer: { id: 'kb-mcp', name: 'kb-mcp' } as MCPRemoteServerInfo,
      files: [
        { path: '/docs/k8s.md', status: 'indexed' },
        { path: '/docs/pods.md', status: 'indexed' },
      ],
    },
  ]);

  render(AgentWorkspaceCreate);

  await navigateToToolsSecretsStep();
  await expandCustomize();

  expect(screen.getByText('kubernetes-knowledges')).toBeInTheDocument();
  expect(screen.getByText('Milvus · 2 sources')).toBeInTheDocument();
  expect(screen.queryByText('No knowledge bases available yet.')).not.toBeInTheDocument();
});

test('Expect Manage Knowledges button navigates to rag environments page', async () => {
  const { handleNavigation } = await import('/@/navigation');

  render(AgentWorkspaceCreate);

  await navigateToToolsSecretsStep();
  await expandCustomize();
  await fireEvent.click(screen.getByRole('button', { name: 'Manage Knowledges' }));

  expect(handleNavigation).toHaveBeenCalledWith({ page: 'rag-environments' });
});

async function navigateToNetworkingStep(): Promise<void> {
  await fireEvent.input(screen.getByPlaceholderText('/path/to/project'), {
    target: { value: '/home/user/my-repo' },
  });
  // Workspace → Agent & Model → Tools & Secrets → File System → Networking
  for (let i = 0; i < 4; i++) {
    await fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  }
}

test('Expect networking step shows Network Policy heading', async () => {
  render(AgentWorkspaceCreate);

  await navigateToNetworkingStep();

  expect(screen.getByText('Network Policy')).toBeInTheDocument();
  expect(screen.getByText('Outbound network for this workspace sandbox')).toBeInTheDocument();
});

test('Expect all four network options rendered with Agent mode disabled', async () => {
  render(AgentWorkspaceCreate);

  await navigateToNetworkingStep();

  expect(screen.getByRole('radio', { name: 'Use Deny All' })).toBeInTheDocument();
  expect(screen.getByRole('radio', { name: 'Use Developer Preset' })).toBeInTheDocument();
  expect(screen.getByRole('radio', { name: 'Use Agent mode' })).toBeInTheDocument();
  expect(screen.getByRole('radio', { name: 'Use Agent mode' })).toBeDisabled();
  expect(screen.getByRole('radio', { name: 'Use Unrestricted' })).toBeInTheDocument();
});

test('Expect clicking disabled Agent mode does not change selection', async () => {
  render(AgentWorkspaceCreate);

  await navigateToNetworkingStep();

  await userEvent.click(screen.getByRole('radio', { name: 'Use Agent mode' }));

  expect(screen.getByRole('radio', { name: 'Use Developer Preset' })).toBeChecked();
  expect(screen.getByRole('radio', { name: 'Use Agent mode' })).not.toBeChecked();
});

test('Expect Developer Preset selected by default on networking step', async () => {
  render(AgentWorkspaceCreate);

  await navigateToNetworkingStep();

  expect(screen.getByRole('radio', { name: 'Use Developer Preset' })).toBeChecked();
  expect(screen.getByRole('radio', { name: 'Use Deny All' })).not.toBeChecked();
});

test('Expect allowlists hint text displayed when Unrestricted selected on networking step', async () => {
  render(AgentWorkspaceCreate);

  await navigateToNetworkingStep();
  await fireEvent.click(screen.getByRole('radio', { name: 'Use Unrestricted' }));

  expect(screen.getByText(/Fine-grained host allowlists and static egress rules/)).toBeInTheDocument();
});

test('Expect selecting a different network option updates the radio', async () => {
  render(AgentWorkspaceCreate);

  await navigateToNetworkingStep();

  await fireEvent.click(screen.getByRole('radio', { name: 'Use Unrestricted' }));

  expect(screen.getByRole('radio', { name: 'Use Unrestricted' })).toBeChecked();
  expect(screen.getByRole('radio', { name: 'Use Developer Preset' })).not.toBeChecked();
});

test('Expect default agent from onboarding.defaultWorkspaceSettings when valid', async () => {
  vi.mocked(window.getConfigurationValue).mockResolvedValue({ defaultAgent: 'claude' });

  render(AgentWorkspaceCreate);

  await fireEvent.input(screen.getByPlaceholderText('/path/to/project'), {
    target: { value: '/home/user/my-repo' },
  });
  await fireEvent.click(screen.getByRole('button', { name: 'Use all defaults and create workspace' }));

  expect(window.getConfigurationValue).toHaveBeenCalledWith('onboarding.defaultWorkspaceSettings');
  expect(window.createAgentWorkspace).toHaveBeenCalledWith(
    expect.objectContaining({
      agent: 'claude',
    }),
  );
});

test('Expect default agent falls back to opencode when setting is empty', async () => {
  vi.mocked(window.getConfigurationValue).mockResolvedValue({ defaultAgent: '' });

  render(AgentWorkspaceCreate);

  await fireEvent.input(screen.getByPlaceholderText('/path/to/project'), {
    target: { value: '/home/user/my-repo' },
  });
  await fireEvent.click(screen.getByRole('button', { name: 'Use all defaults and create workspace' }));

  expect(window.createAgentWorkspace).toHaveBeenCalledWith(
    expect.objectContaining({
      agent: 'opencode',
      network: {
        mode: 'deny',
        hosts: ['registry.npmjs.org', 'pypi.python.org'],
      },
    }),
  );
});

test('Expect default agent falls back to opencode when setting is unknown value', async () => {
  vi.mocked(window.getConfigurationValue).mockResolvedValue({ defaultAgent: 'unknown-agent' });

  render(AgentWorkspaceCreate);

  await fireEvent.input(screen.getByPlaceholderText('/path/to/project'), {
    target: { value: '/home/user/my-repo' },
  });
  await fireEvent.click(screen.getByRole('button', { name: 'Use all defaults and create workspace' }));

  expect(window.createAgentWorkspace).toHaveBeenCalledWith(
    expect.objectContaining({
      agent: 'opencode',
    }),
  );
});

test('Expect createAgentWorkspace called with deny network when blocked selected', async () => {
  render(AgentWorkspaceCreate);

  await navigateToNetworkingStep();
  await fireEvent.click(screen.getByRole('radio', { name: 'Use Deny All' }));
  await fireEvent.click(screen.getByRole('button', { name: 'Start Workspace' }));

  expect(window.createAgentWorkspace).toHaveBeenCalledWith(
    expect.objectContaining({
      network: { mode: 'deny' },
    }),
  );
});

test('Expect createAgentWorkspace called without network when agent_mode selected', async () => {
  render(AgentWorkspaceCreate);

  await navigateToNetworkingStep();
  await fireEvent.click(screen.getByRole('radio', { name: 'Use Agent mode' }));
  await fireEvent.click(screen.getByRole('button', { name: 'Start Workspace' }));

  expect(window.createAgentWorkspace).toHaveBeenCalledWith(
    expect.objectContaining({
      network: undefined,
    }),
  );
});

const mockAnthropicProvider: ProviderInfo = {
  id: 'claude',
  name: 'Anthropic',
  internalId: 'claude-internal',
  status: 'started',
  inferenceConnections: [
    {
      name: 'Anthropic Cloud',
      type: 'cloud',
      status: 'started',
      llmMetadata: { name: 'anthropic' },
      models: [{ label: 'claude-sonnet-4' }, { label: 'claude-opus-4' }],
    },
  ],
  inferenceProviderConnectionCreation: false,
} as unknown as ProviderInfo;

const mockOllamaProvider: ProviderInfo = {
  id: 'ollama',
  name: 'Ollama',
  internalId: 'ollama-internal',
  status: 'started',
  inferenceConnections: [
    {
      name: 'Ollama Local',
      type: 'local',
      status: 'started',
      llmMetadata: { name: 'ollama' },
      models: [{ label: 'llama3.2:3b' }],
    },
  ],
  inferenceProviderConnectionCreation: false,
} as unknown as ProviderInfo;

test('Expect default model from onboarding.defaultWorkspaceSettings when valid', async () => {
  vi.mocked(window.getConfigurationValue).mockResolvedValue({
    defaultAgent: 'opencode',
    defaultAgentSettings: {
      opencode: {
        defaultModel: { providerId: 'claude', connectionName: 'Anthropic Cloud', label: 'claude-sonnet-4' },
      },
    },
  });
  vi.mocked(providerStore).providerInfos = writable<ProviderInfo[]>([mockAnthropicProvider]);

  render(AgentWorkspaceCreate);

  await fireEvent.input(screen.getByPlaceholderText('/path/to/project'), {
    target: { value: '/home/user/my-repo' },
  });
  await fireEvent.click(screen.getByRole('button', { name: 'Use all defaults and create workspace' }));

  expect(window.getConfigurationValue).toHaveBeenCalledWith('onboarding.defaultWorkspaceSettings');
  expect(window.createAgentWorkspace).toHaveBeenCalledWith(
    expect.objectContaining({
      model: 'anthropic::claude-sonnet-4::',
    }),
  );
});

test('Expect first compatible model used when defaultWorkspaceSettings has no model and providers exist', async () => {
  vi.mocked(window.getConfigurationValue).mockResolvedValue({ defaultAgent: 'opencode' });
  vi.mocked(providerStore).providerInfos = writable<ProviderInfo[]>([mockAnthropicProvider, mockOllamaProvider]);

  render(AgentWorkspaceCreate);

  await fireEvent.input(screen.getByPlaceholderText('/path/to/project'), {
    target: { value: '/home/user/my-repo' },
  });
  await fireEvent.click(screen.getByRole('button', { name: 'Use all defaults and create workspace' }));

  expect(window.createAgentWorkspace).toHaveBeenCalledWith(
    expect.objectContaining({
      model: 'anthropic::claude-sonnet-4::',
    }),
  );
});

test('Expect model empty when no setting and no providers', async () => {
  vi.mocked(window.getConfigurationValue).mockResolvedValue({ defaultAgent: 'opencode' });

  render(AgentWorkspaceCreate);

  await fireEvent.input(screen.getByPlaceholderText('/path/to/project'), {
    target: { value: '/home/user/my-repo' },
  });
  await fireEvent.click(screen.getByRole('button', { name: 'Use all defaults and create workspace' }));

  expect(window.createAgentWorkspace).toHaveBeenCalledWith(
    expect.objectContaining({
      model: undefined,
      agent: 'opencode',
      name: 'my-repo',
      skills: undefined,
    }),
  );
});

test('Expect first compatible model used when defaultWorkspaceSettings is undefined and providers exist', async () => {
  vi.mocked(window.getConfigurationValue).mockResolvedValue(undefined);
  vi.mocked(providerStore).providerInfos = writable<ProviderInfo[]>([mockOllamaProvider]);

  render(AgentWorkspaceCreate);

  await fireEvent.input(screen.getByPlaceholderText('/path/to/project'), {
    target: { value: '/home/user/my-repo' },
  });
  await fireEvent.click(screen.getByRole('button', { name: 'Use all defaults and create workspace' }));

  expect(window.createAgentWorkspace).toHaveBeenCalledWith(
    expect.objectContaining({
      model: 'ollama::llama3.2:3b::',
    }),
  );
});

test('Expect custom hosts input shown when Deny All is selected on networking step', async () => {
  render(AgentWorkspaceCreate);

  await navigateToNetworkingStep();
  await fireEvent.click(screen.getByRole('radio', { name: 'Use Deny All' }));

  expect(screen.getByLabelText('Custom host 1')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Add Another Host' })).toBeInTheDocument();
});

test('Expect custom hosts pre-populated with registry hosts when Developer Preset is selected', async () => {
  render(AgentWorkspaceCreate);

  await navigateToNetworkingStep();

  expect(screen.getByLabelText('Custom host 1')).toBeInTheDocument();
  expect((screen.getByLabelText('Custom host 1') as HTMLInputElement).value).toBe('registry.npmjs.org');
  expect((screen.getByLabelText('Custom host 2') as HTMLInputElement).value).toBe('pypi.python.org');
  expect(screen.getByRole('button', { name: 'Add Another Host' })).toBeInTheDocument();
});

test('Expect custom hosts input hidden when Agent mode is selected on networking step', async () => {
  render(AgentWorkspaceCreate);

  await navigateToNetworkingStep();
  await fireEvent.click(screen.getByRole('radio', { name: 'Use Agent mode' }));

  expect(screen.queryByLabelText('Custom host 1')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Add Another Host' })).not.toBeInTheDocument();
});

test('Expect custom hosts input hidden when Unrestricted is selected on networking step', async () => {
  render(AgentWorkspaceCreate);

  await navigateToNetworkingStep();
  await fireEvent.click(screen.getByRole('radio', { name: 'Use Unrestricted' }));

  expect(screen.queryByLabelText('Custom host 1')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Add Another Host' })).not.toBeInTheDocument();
});

test('Expect createAgentWorkspace called with registry hosts plus custom host for Developer Preset', async () => {
  render(AgentWorkspaceCreate);

  await navigateToNetworkingStep();

  await fireEvent.click(screen.getByRole('button', { name: 'Add Another Host' }));
  await fireEvent.input(screen.getByLabelText('Custom host 3'), {
    target: { value: 'api.example.com' },
  });
  await fireEvent.click(screen.getByRole('button', { name: 'Start Workspace' }));

  expect(window.createAgentWorkspace).toHaveBeenCalledWith(
    expect.objectContaining({
      network: { mode: 'deny', hosts: ['registry.npmjs.org', 'pypi.python.org', 'api.example.com'] },
    }),
  );
});

test('Expect createAgentWorkspace splits MCP servers into remote and command entries', async () => {
  vi.mocked(mcpStore).mcpRemoteServerInfos = writable<MCPRemoteServerInfo[]>([
    {
      id: 'mcp-remote',
      name: 'GitHub MCP',
      description: 'Repos & PRs',
      url: 'https://mcp.github.com/sse',
      setupType: 'remote',
      infos: { internalProviderId: 'p1', serverId: 's1', remoteId: 1 },
      tools: { 'list-repos': {} },
    },
    {
      id: 'mcp-pkg',
      name: 'NPM MCP',
      description: 'Node MCP server',
      url: '',
      setupType: 'package',
      commandSpec: { command: 'npx', args: ['@example/mcp@1.0.0'] },
      infos: { internalProviderId: 'p2', serverId: 's2', remoteId: 0 },
      tools: {},
    },
  ]);

  render(AgentWorkspaceCreate);

  await fireEvent.input(screen.getByPlaceholderText('/path/to/project'), {
    target: { value: '/home/user/my-repo' },
  });
  await fireEvent.click(screen.getByRole('button', { name: 'Use all defaults and create workspace' }));

  expect(window.createAgentWorkspace).toHaveBeenCalledWith(
    expect.objectContaining({
      mcp: {
        servers: [{ name: 'GitHub MCP', url: 'https://mcp.github.com/sse' }],
        commands: [{ name: 'NPM MCP', command: 'npx', args: ['@example/mcp@1.0.0'], env: undefined }],
      },
    }),
  );
});

test('Expect createAgentWorkspace called with custom hosts only for Deny All with custom host', async () => {
  render(AgentWorkspaceCreate);

  await navigateToNetworkingStep();
  await fireEvent.click(screen.getByRole('radio', { name: 'Use Deny All' }));

  await fireEvent.input(screen.getByLabelText('Custom host 1'), {
    target: { value: 'internal.corp.io' },
  });
  await fireEvent.click(screen.getByRole('button', { name: 'Start Workspace' }));

  expect(window.createAgentWorkspace).toHaveBeenCalledWith(
    expect.objectContaining({
      network: { mode: 'deny', hosts: ['internal.corp.io'] },
    }),
  );
});

test('Expect Add Another Host button adds a new input field', async () => {
  render(AgentWorkspaceCreate);

  await navigateToNetworkingStep();

  expect(screen.queryByLabelText('Custom host 3')).not.toBeInTheDocument();

  await fireEvent.click(screen.getByRole('button', { name: 'Add Another Host' }));

  expect(screen.getByLabelText('Custom host 3')).toBeInTheDocument();
});

test('Expect Remove button removes a registry host', async () => {
  render(AgentWorkspaceCreate);

  await navigateToNetworkingStep();

  expect(screen.getByLabelText('Custom host 2')).toBeInTheDocument();

  await fireEvent.click(screen.getByRole('button', { name: 'Remove host 2' }));

  expect(screen.queryByLabelText('Custom host 2')).not.toBeInTheDocument();
});

test('Expect createAgentWorkspace called without removed registry host for Developer Preset', async () => {
  render(AgentWorkspaceCreate);

  await navigateToNetworkingStep();

  await fireEvent.click(screen.getByRole('button', { name: 'Remove host 1' }));
  await fireEvent.click(screen.getByRole('button', { name: 'Start Workspace' }));

  expect(window.createAgentWorkspace).toHaveBeenCalledWith(
    expect.objectContaining({
      network: { mode: 'deny', hosts: ['pypi.python.org'] },
    }),
  );
});

test('Expect Deny All resets to empty host list when switching from Developer Preset', async () => {
  render(AgentWorkspaceCreate);

  await navigateToNetworkingStep();

  expect((screen.getByLabelText('Custom host 1') as HTMLInputElement).value).toBe('registry.npmjs.org');

  await fireEvent.click(screen.getByRole('radio', { name: 'Use Deny All' }));

  expect((screen.getByLabelText('Custom host 1') as HTMLInputElement).value).toBe('');
});

test('Expect Unrestricted network option disabled when runtime is openshell', async () => {
  vi.mocked(agentWorkspaceRuntimeStore).agentWorkspaceRuntime = writable<string>('openshell');
  render(AgentWorkspaceCreate);

  await navigateToNetworkingStep();

  expect(screen.getByRole('radio', { name: 'Use Unrestricted' })).toBeDisabled();
});

test('Expect Unrestricted network option enabled when runtime is podman', async () => {
  vi.mocked(agentWorkspaceRuntimeStore).agentWorkspaceRuntime = writable<string>('podman');
  render(AgentWorkspaceCreate);

  await navigateToNetworkingStep();

  expect(screen.getByRole('radio', { name: 'Use Unrestricted' })).toBeEnabled();
});

test('Expect createAgentWorkspace called with workspaceConfiguration from settings for selected agent', async () => {
  vi.mocked(window.getConfigurationValue).mockResolvedValue({
    defaultAgent: 'claude',
    defaultAgentSettings: {
      claude: {
        defaultModel: { providerId: 'claude', connectionName: 'Anthropic Cloud', label: 'claude-sonnet-4' },
        workspaceConfiguration: {
          environment: [
            { name: 'CLAUDE_CODE_USE_VERTEX', value: '1' },
            { name: 'CLOUD_ML_REGION', value: 'us-east5' },
          ],
          mounts: [
            {
              host: '$HOME/.config/gcloud/application_default_credentials.json',
              target: '$HOME/.config/gcloud/application_default_credentials.json',
              ro: true,
            },
          ],
        },
      },
    },
  });
  vi.mocked(providerStore).providerInfos = writable<ProviderInfo[]>([mockAnthropicProvider]);

  render(AgentWorkspaceCreate);

  await fireEvent.input(screen.getByPlaceholderText('/path/to/project'), {
    target: { value: '/home/user/my-repo' },
  });
  await fireEvent.click(screen.getByRole('button', { name: 'Use all defaults and create workspace' }));

  expect(window.createAgentWorkspace).toHaveBeenCalledWith(
    expect.objectContaining({
      agent: 'claude',
      workspaceConfiguration: {
        environment: [
          { name: 'CLAUDE_CODE_USE_VERTEX', value: '1' },
          { name: 'CLOUD_ML_REGION', value: 'us-east5' },
        ],
        mounts: [
          {
            host: '$HOME/.config/gcloud/application_default_credentials.json',
            target: '$HOME/.config/gcloud/application_default_credentials.json',
            ro: true,
          },
        ],
      },
    }),
  );
});

test('Expect workspaceConfiguration undefined when no settings for selected agent', async () => {
  vi.mocked(window.getConfigurationValue).mockResolvedValue({
    defaultAgent: 'opencode',
    defaultAgentSettings: {
      opencode: {
        defaultModel: { providerId: 'claude', connectionName: 'Anthropic Cloud', label: 'claude-sonnet-4' },
      },
    },
  });
  vi.mocked(providerStore).providerInfos = writable<ProviderInfo[]>([mockAnthropicProvider]);

  render(AgentWorkspaceCreate);

  await fireEvent.input(screen.getByPlaceholderText('/path/to/project'), {
    target: { value: '/home/user/my-repo' },
  });
  await fireEvent.click(screen.getByRole('button', { name: 'Use all defaults and create workspace' }));

  expect(window.createAgentWorkspace).toHaveBeenCalledWith(
    expect.objectContaining({
      agent: 'opencode',
      workspaceConfiguration: undefined,
    }),
  );
});

test('Expect workspaceConfiguration resolved via cliAgent for variant agents like claude-vertex', async () => {
  vi.mocked(window.getConfigurationValue).mockResolvedValue({
    defaultAgent: 'claude-vertex',
    defaultAgentSettings: {
      claude: {
        workspaceConfiguration: {
          environment: [{ name: 'CLAUDE_CODE_USE_VERTEX', value: '1' }],
        },
      },
    },
  });

  render(AgentWorkspaceCreate);

  await fireEvent.input(screen.getByPlaceholderText('/path/to/project'), {
    target: { value: '/home/user/my-repo' },
  });
  await fireEvent.click(screen.getByRole('button', { name: 'Use all defaults and create workspace' }));

  expect(window.createAgentWorkspace).toHaveBeenCalledWith(
    expect.objectContaining({
      agent: 'claude',
      workspaceConfiguration: {
        environment: [{ name: 'CLAUDE_CODE_USE_VERTEX', value: '1' }],
      },
    }),
  );
});

test('Expect workspaceConfiguration falls back to raw agent key when resolved key has no config', async () => {
  vi.mocked(window.getConfigurationValue).mockResolvedValue({
    defaultAgent: 'claude-vertex',
    defaultAgentSettings: {
      'claude-vertex': {
        workspaceConfiguration: {
          environment: [{ name: 'CLOUD_ML_REGION', value: 'us-east5' }],
          mounts: [
            {
              host: '$HOME/.config/gcloud/application_default_credentials.json',
              target: '$HOME/.config/gcloud/application_default_credentials.json',
              ro: true,
            },
          ],
        },
      },
    },
  });

  render(AgentWorkspaceCreate);

  await fireEvent.input(screen.getByPlaceholderText('/path/to/project'), {
    target: { value: '/home/user/my-repo' },
  });
  await fireEvent.click(screen.getByRole('button', { name: 'Use all defaults and create workspace' }));

  expect(window.createAgentWorkspace).toHaveBeenCalledWith(
    expect.objectContaining({
      agent: 'claude',
      workspaceConfiguration: {
        environment: [{ name: 'CLOUD_ML_REGION', value: 'us-east5' }],
        mounts: [
          {
            host: '$HOME/.config/gcloud/application_default_credentials.json',
            target: '$HOME/.config/gcloud/application_default_credentials.json',
            ro: true,
          },
        ],
      },
    }),
  );
});

test('Expect tilde mount paths normalized to $HOME in workspaceConfiguration', async () => {
  vi.mocked(window.getConfigurationValue).mockResolvedValue({
    defaultAgent: 'claude',
    defaultAgentSettings: {
      claude: {
        workspaceConfiguration: {
          mounts: [
            {
              host: '~/.config/gcloud/application_default_credentials.json',
              target: '~/.config/gcloud/application_default_credentials.json',
              ro: true,
            },
          ],
        },
      },
    },
  });
  vi.mocked(providerStore).providerInfos = writable<ProviderInfo[]>([mockAnthropicProvider]);

  render(AgentWorkspaceCreate);

  await fireEvent.input(screen.getByPlaceholderText('/path/to/project'), {
    target: { value: '/home/user/my-repo' },
  });
  await fireEvent.click(screen.getByRole('button', { name: 'Use all defaults and create workspace' }));

  expect(window.createAgentWorkspace).toHaveBeenCalledWith(
    expect.objectContaining({
      workspaceConfiguration: {
        mounts: [
          {
            host: '$HOME/.config/gcloud/application_default_credentials.json',
            target: '$HOME/.config/gcloud/application_default_credentials.json',
            ro: true,
          },
        ],
      },
    }),
  );
});

const wizardStepCount = 5;
