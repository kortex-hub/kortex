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
import { writable } from 'svelte/store';
import { router } from 'tinro';
import { beforeEach, expect, test, vi } from 'vitest';

import * as mcpStore from '/@/stores/mcp-remote-servers';
import * as ragStore from '/@/stores/rag-environments';
import * as skillsStore from '/@/stores/skills';
import type { AgentWorkspaceConfiguration, AgentWorkspaceSummary } from '/@api/agent-workspace-info';
import type { MCPRemoteServerInfo } from '/@api/mcp/mcp-server-info';
import type { RagEnvironment } from '/@api/rag/rag-environment';
import type { SkillInfo } from '/@api/skill/skill-info';

import AgentWorkspaceDetailsSettings from './AgentWorkspaceDetailsSettings.svelte';

vi.mock(import('tinro'));
vi.mock(import('/@/stores/skills'));
vi.mock(import('/@/stores/rag-environments'));
vi.mock(import('/@/navigation'));
vi.mock(import('/@/stores/mcp-remote-servers'));

const routerStore = writable({
  path: '/agent-workspaces/ws-1/settings',
  url: '/agent-workspaces/ws-1/settings',
  from: '/',
  query: {} as Record<string, string>,
  hash: '',
});

const workspaceSummary: AgentWorkspaceSummary = {
  id: 'ws-1',
  name: 'api-refactor',
  project: 'backend',
  agent: 'opencode',
  model: 'gpt-4o',
  runtime: 'podman',
  state: 'stopped',
  paths: {
    source: '/home/user/projects/backend',
    configuration: '/home/user/.config/kaiden/workspaces/api-refactor.yaml',
  },
  timestamps: { created: 1700000000000, started: 1700100000000 },
  forwards: [],
};

const configuration: AgentWorkspaceConfiguration = {
  mounts: [{ host: '$SOURCES/../shared-lib', target: '/workspace/shared-lib', ro: false }],
  environment: [{ name: 'API_KEY', value: 'test-key' }],
};

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.resetAllMocks();
  vi.mocked(router).subscribe.mockImplementation(routerStore.subscribe);
  vi.mocked(window.updateAgentWorkspaceSummary).mockResolvedValue(undefined);
  vi.mocked(window.updateAgentWorkspaceConfiguration).mockResolvedValue(undefined);
  vi.mocked(skillsStore).skillInfos = writable<readonly SkillInfo[]>([]);
  vi.mocked(ragStore).ragEnvironments = writable<RagEnvironment[]>([]);
  vi.mocked(mcpStore).mcpRemoteServerInfos = writable<readonly MCPRemoteServerInfo[]>([]);
});

test('Expect General section is active by default with workspace info', () => {
  render(AgentWorkspaceDetailsSettings, { workspaceId: 'ws-1', workspaceSummary, configuration });

  expect(screen.getByText('Workspace Information')).toBeInTheDocument();
});

test('Expect workspace name is displayed in input', () => {
  render(AgentWorkspaceDetailsSettings, { workspaceId: 'ws-1', workspaceSummary, configuration });

  const nameInput = screen.getByRole('textbox', { name: 'Workspace Name' });
  expect(nameInput).toHaveValue('api-refactor');
});

test('Expect working directory is displayed in input', () => {
  render(AgentWorkspaceDetailsSettings, { workspaceId: 'ws-1', workspaceSummary, configuration });

  const dirInput = screen.getByRole('textbox', { name: 'Working Directory' });
  expect(dirInput).toHaveValue('/home/user/projects/backend');
});

test('Expect all settings nav sections are rendered', () => {
  render(AgentWorkspaceDetailsSettings, { workspaceId: 'ws-1', workspaceSummary, configuration });

  for (const label of ['General', 'Agent Skills', 'MCP Servers', 'Knowledge', 'File Access', 'Network', 'Advanced']) {
    expect(screen.getByRole('link', { name: label })).toBeInTheDocument();
  }
});

test('Expect workspace name input is editable', async () => {
  render(AgentWorkspaceDetailsSettings, { workspaceId: 'ws-1', workspaceSummary, configuration });

  const nameInput = screen.getByRole('textbox', { name: 'Workspace Name' });
  expect(nameInput).not.toHaveAttribute('readonly');
  await fireEvent.input(nameInput, { target: { value: 'new-name' } });
  expect(nameInput).toHaveValue('new-name');
});

test('Expect save/discard bar shown when workspace name is modified', async () => {
  render(AgentWorkspaceDetailsSettings, { workspaceId: 'ws-1', workspaceSummary, configuration });

  const nameInput = screen.getByRole('textbox', { name: 'Workspace Name' });
  await fireEvent.input(nameInput, { target: { value: 'renamed' } });

  expect(screen.getByText('You have unsaved changes')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Discard changes' })).toBeInTheDocument();
});

test('Expect save/discard bar not shown when workspace name matches original', async () => {
  render(AgentWorkspaceDetailsSettings, { workspaceId: 'ws-1', workspaceSummary, configuration });

  const nameInput = screen.getByRole('textbox', { name: 'Workspace Name' });
  await fireEvent.input(nameInput, { target: { value: 'api-refactor' } });

  expect(screen.queryByText('You have unsaved changes')).not.toBeInTheDocument();
});

test('Expect clicking Save changes calls updateAgentWorkspaceSummary', async () => {
  render(AgentWorkspaceDetailsSettings, { workspaceId: 'ws-1', workspaceSummary, configuration });

  const nameInput = screen.getByRole('textbox', { name: 'Workspace Name' });
  await fireEvent.input(nameInput, { target: { value: 'renamed' } });
  await fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

  expect(window.updateAgentWorkspaceSummary).toHaveBeenCalledWith('ws-1', { name: 'renamed' });
});

test('Expect clicking Discard changes resets workspace name to original', async () => {
  render(AgentWorkspaceDetailsSettings, { workspaceId: 'ws-1', workspaceSummary, configuration });

  const nameInput = screen.getByRole('textbox', { name: 'Workspace Name' });
  await fireEvent.input(nameInput, { target: { value: 'renamed' } });
  await fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }));

  expect(nameInput).toHaveValue('api-refactor');
  expect(screen.queryByText('You have unsaved changes')).not.toBeInTheDocument();
  expect(window.updateAgentWorkspaceSummary).not.toHaveBeenCalled();
});

test('Expect no save when workspace name has not changed', async () => {
  render(AgentWorkspaceDetailsSettings, { workspaceId: 'ws-1', workspaceSummary, configuration });

  const nameInput = screen.getByRole('textbox', { name: 'Workspace Name' });
  await fireEvent.input(nameInput, { target: { value: 'api-refactor' } });

  expect(window.updateAgentWorkspaceSummary).not.toHaveBeenCalled();
});

test('Expect working directory input is readonly', () => {
  render(AgentWorkspaceDetailsSettings, { workspaceId: 'ws-1', workspaceSummary, configuration });

  const dirInput = screen.getByRole('textbox', { name: 'Working Directory' });
  expect(dirInput).toHaveAttribute('readonly');
});

test('Expect empty inputs when workspace summary is undefined', () => {
  render(AgentWorkspaceDetailsSettings, { workspaceId: 'ws-1', workspaceSummary: undefined, configuration: {} });

  const nameInput = screen.getByRole('textbox', { name: 'Workspace Name' });
  expect(nameInput).toHaveValue('');

  const dirInput = screen.getByRole('textbox', { name: 'Working Directory' });
  expect(dirInput).toHaveValue('');
});

test('Expect skills checklist shown when switching to Agent Skills section', async () => {
  vi.mocked(skillsStore).skillInfos = writable<readonly SkillInfo[]>([
    { name: 'kubernetes', description: 'Deploy clusters', path: '/skills/kubernetes', enabled: true, managed: false },
  ]);

  render(AgentWorkspaceDetailsSettings, { workspaceId: 'ws-1', workspaceSummary, configuration });

  await fireEvent.click(screen.getByRole('link', { name: 'Agent Skills' }));

  expect(screen.getByText('Skills')).toBeInTheDocument();
  expect(screen.getByText('kubernetes')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Manage Skills' })).toBeInTheDocument();
});

test('Expect empty state when no skills available', async () => {
  render(AgentWorkspaceDetailsSettings, { workspaceId: 'ws-1', workspaceSummary, configuration });

  await fireEvent.click(screen.getByRole('link', { name: 'Agent Skills' }));

  expect(screen.getByText('No skills available yet.')).toBeInTheDocument();
});

test('Expect configured skills are pre-selected', async () => {
  vi.mocked(skillsStore).skillInfos = writable<readonly SkillInfo[]>([
    { name: 'kubernetes', description: 'Deploy clusters', path: '/skills/kubernetes', enabled: true, managed: false },
    { name: 'code-review', description: 'Analyze code', path: '/skills/code-review', enabled: true, managed: true },
  ]);

  const configWithSkills: AgentWorkspaceConfiguration = {
    ...configuration,
    skills: ['/skills/kubernetes'],
  };

  render(AgentWorkspaceDetailsSettings, {
    workspaceId: 'ws-1',
    workspaceSummary,
    configuration: configWithSkills,
  });

  await fireEvent.click(screen.getByRole('link', { name: 'Agent Skills' }));

  expect(screen.getByText('1 of 2 selected')).toBeInTheDocument();
});

test('Expect toggling a skill shows save bar without immediate save', async () => {
  vi.mocked(skillsStore).skillInfos = writable<readonly SkillInfo[]>([
    { name: 'kubernetes', description: 'Deploy clusters', path: '/skills/kubernetes', enabled: true, managed: false },
  ]);

  render(AgentWorkspaceDetailsSettings, { workspaceId: 'ws-1', workspaceSummary, configuration });

  await fireEvent.click(screen.getByRole('link', { name: 'Agent Skills' }));
  await fireEvent.click(screen.getByRole('button', { name: 'kubernetes' }));

  expect(screen.getByText('You have unsaved changes')).toBeInTheDocument();
  expect(window.updateAgentWorkspaceConfiguration).not.toHaveBeenCalled();
});

test('Expect Save changes persists skill selection', async () => {
  vi.mocked(skillsStore).skillInfos = writable<readonly SkillInfo[]>([
    { name: 'kubernetes', description: 'Deploy clusters', path: '/skills/kubernetes', enabled: true, managed: false },
  ]);

  render(AgentWorkspaceDetailsSettings, { workspaceId: 'ws-1', workspaceSummary, configuration });

  await fireEvent.click(screen.getByRole('link', { name: 'Agent Skills' }));
  await fireEvent.click(screen.getByRole('button', { name: 'kubernetes' }));
  await fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

  expect(window.updateAgentWorkspaceConfiguration).toHaveBeenCalledWith('ws-1', {
    skills: ['/skills/kubernetes'],
  });
});

test('Expect Discard changes resets skill selection', async () => {
  vi.mocked(skillsStore).skillInfos = writable<readonly SkillInfo[]>([
    { name: 'kubernetes', description: 'Deploy clusters', path: '/skills/kubernetes', enabled: true, managed: false },
  ]);

  render(AgentWorkspaceDetailsSettings, { workspaceId: 'ws-1', workspaceSummary, configuration });

  await fireEvent.click(screen.getByRole('link', { name: 'Agent Skills' }));
  await fireEvent.click(screen.getByRole('button', { name: 'kubernetes' }));
  await fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }));

  expect(screen.queryByText('You have unsaved changes')).not.toBeInTheDocument();
  expect(window.updateAgentWorkspaceConfiguration).not.toHaveBeenCalled();
});

test('Expect removing all skills saves undefined when Save changes clicked', async () => {
  vi.mocked(skillsStore).skillInfos = writable<readonly SkillInfo[]>([
    { name: 'kubernetes', description: 'Deploy clusters', path: '/skills/kubernetes', enabled: true, managed: false },
  ]);

  const configWithSkills: AgentWorkspaceConfiguration = {
    ...configuration,
    skills: ['/skills/kubernetes'],
  };

  render(AgentWorkspaceDetailsSettings, {
    workspaceId: 'ws-1',
    workspaceSummary,
    configuration: configWithSkills,
  });

  await fireEvent.click(screen.getByRole('link', { name: 'Agent Skills' }));
  await fireEvent.click(screen.getByRole('button', { name: 'kubernetes' }));
  await fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

  expect(window.updateAgentWorkspaceConfiguration).toHaveBeenCalledWith('ws-1', {
    skills: undefined,
  });
});

test('Expect all skills shown including disabled ones', async () => {
  vi.mocked(skillsStore).skillInfos = writable<readonly SkillInfo[]>([
    { name: 'kubernetes', description: 'Deploy clusters', path: '/skills/kubernetes', enabled: true, managed: false },
    { name: 'disabled-skill', description: 'Not active', path: '/skills/disabled', enabled: false, managed: false },
  ]);

  render(AgentWorkspaceDetailsSettings, { workspaceId: 'ws-1', workspaceSummary, configuration });

  await fireEvent.click(screen.getByRole('link', { name: 'Agent Skills' }));

  expect(screen.getByText('kubernetes')).toBeInTheDocument();
  expect(screen.getByText('disabled-skill')).toBeInTheDocument();
});

test('Expect Manage Skills button navigates to skills page', async () => {
  const { handleNavigation } = await import('/@/navigation');

  render(AgentWorkspaceDetailsSettings, { workspaceId: 'ws-1', workspaceSummary, configuration });

  await fireEvent.click(screen.getByRole('link', { name: 'Agent Skills' }));
  await fireEvent.click(screen.getByRole('button', { name: 'Manage Skills' }));

  expect(handleNavigation).toHaveBeenCalledWith({ page: 'skills' });
});

test('Expect name save failure rolls back workspace name', async () => {
  vi.mocked(window.updateAgentWorkspaceSummary).mockRejectedValueOnce(new Error('network error'));

  render(AgentWorkspaceDetailsSettings, { workspaceId: 'ws-1', workspaceSummary, configuration });

  const nameInput = screen.getByRole('textbox', { name: 'Workspace Name' });
  await fireEvent.input(nameInput, { target: { value: 'renamed' } });
  await fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

  expect(nameInput).toHaveValue('api-refactor');
  expect(screen.queryByText('You have unsaved changes')).not.toBeInTheDocument();
});

test('Expect skills save failure rolls back skill selection', async () => {
  vi.mocked(window.updateAgentWorkspaceConfiguration).mockRejectedValueOnce(new Error('network error'));

  vi.mocked(skillsStore).skillInfos = writable<readonly SkillInfo[]>([
    { name: 'kubernetes', description: 'Deploy clusters', path: '/skills/kubernetes', enabled: true, managed: false },
  ]);

  render(AgentWorkspaceDetailsSettings, { workspaceId: 'ws-1', workspaceSummary, configuration });

  await fireEvent.click(screen.getByRole('link', { name: 'Agent Skills' }));
  await fireEvent.click(screen.getByRole('button', { name: 'kubernetes' }));
  await fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

  expect(screen.queryByText('You have unsaved changes')).not.toBeInTheDocument();
  expect(screen.getByText('0 of 1 selected')).toBeInTheDocument();
});

// --- File Access section tests ---

test('Expect File Access section shows Custom Paths selected for existing custom mounts', async () => {
  render(AgentWorkspaceDetailsSettings, { workspaceId: 'ws-1', workspaceSummary, configuration });

  const fileAccessNav = screen.getByRole('link', { name: 'File Access' });
  await fireEvent.click(fileAccessNav);

  const customRadio = screen.getByRole('radio', { name: 'Use Custom Paths' });
  expect(customRadio).toBeChecked();
  const hostInput = screen.getByRole('textbox', { name: 'Host path 1' });
  expect(hostInput).toHaveValue('$SOURCES/../shared-lib');
  const targetInput = screen.getByRole('textbox', { name: 'Target path 1' });
  expect(targetInput).toHaveValue('/workspace/shared-lib');
});

test('Expect File Access section defaults to No host filesystem access when no mounts', async () => {
  render(AgentWorkspaceDetailsSettings, { workspaceId: 'ws-1', workspaceSummary, configuration: {} });

  const fileAccessNav = screen.getByRole('link', { name: 'File Access' });
  await fireEvent.click(fileAccessNav);

  const workspaceRadio = screen.getByRole('radio', { name: 'Use No host filesystem access' });
  expect(workspaceRadio).toBeChecked();
  expect(screen.queryByRole('textbox', { name: 'Host path 1' })).not.toBeInTheDocument();
});

test('Expect selecting Custom Paths shows mount editor with empty mount', async () => {
  render(AgentWorkspaceDetailsSettings, { workspaceId: 'ws-1', workspaceSummary, configuration: {} });

  const fileAccessNav = screen.getByRole('link', { name: 'File Access' });
  await fireEvent.click(fileAccessNav);

  await fireEvent.click(screen.getByRole('button', { name: 'Custom Paths' }));

  expect(screen.getByRole('textbox', { name: 'Host path 1' })).toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: 'Target path 1' })).toBeInTheDocument();
});

test('Expect switching file access mode shows unsaved changes', async () => {
  render(AgentWorkspaceDetailsSettings, { workspaceId: 'ws-1', workspaceSummary, configuration: {} });

  const fileAccessNav = screen.getByRole('link', { name: 'File Access' });
  await fireEvent.click(fileAccessNav);

  await fireEvent.click(screen.getByRole('button', { name: 'Home Directory' }));

  expect(screen.getByText('You have unsaved changes')).toBeInTheDocument();
});

test('Expect toggling read-only updates the button text', async () => {
  render(AgentWorkspaceDetailsSettings, { workspaceId: 'ws-1', workspaceSummary, configuration });

  const fileAccessNav = screen.getByRole('link', { name: 'File Access' });
  await fireEvent.click(fileAccessNav);

  const toggleBtn = screen.getByRole('button', { name: 'Toggle read-only for mount 1' });
  expect(toggleBtn).toHaveTextContent('read-write');

  await fireEvent.click(toggleBtn);

  expect(screen.getByRole('button', { name: 'Toggle read-only for mount 1' })).toHaveTextContent('read-only');
});

test('Expect saving Home Directory mode calls updateAgentWorkspaceConfiguration', async () => {
  render(AgentWorkspaceDetailsSettings, { workspaceId: 'ws-1', workspaceSummary, configuration: {} });

  const fileAccessNav = screen.getByRole('link', { name: 'File Access' });
  await fireEvent.click(fileAccessNav);

  await fireEvent.click(screen.getByRole('button', { name: 'Home Directory' }));
  await fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

  expect(window.updateAgentWorkspaceConfiguration).toHaveBeenCalledWith('ws-1', {
    mounts: [{ host: '$HOME', target: '$HOME', ro: false }],
  });
});

test('Expect saving custom mounts calls updateAgentWorkspaceConfiguration', async () => {
  render(AgentWorkspaceDetailsSettings, { workspaceId: 'ws-1', workspaceSummary, configuration: {} });

  const fileAccessNav = screen.getByRole('link', { name: 'File Access' });
  await fireEvent.click(fileAccessNav);

  await fireEvent.click(screen.getByRole('button', { name: 'Custom Paths' }));
  const hostInput = screen.getByRole('textbox', { name: 'Host path 1' });
  await fireEvent.input(hostInput, { target: { value: '/home/user/data' } });
  const targetInput = screen.getByRole('textbox', { name: 'Target path 1' });
  await fireEvent.input(targetInput, { target: { value: '/workspace/data' } });

  await fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

  expect(window.updateAgentWorkspaceConfiguration).toHaveBeenCalledWith('ws-1', {
    mounts: [{ host: '/home/user/data', target: '/workspace/data', ro: false }],
  });
});

test('Expect discarding file access changes resets to original mode', async () => {
  render(AgentWorkspaceDetailsSettings, { workspaceId: 'ws-1', workspaceSummary, configuration });

  const fileAccessNav = screen.getByRole('link', { name: 'File Access' });
  await fireEvent.click(fileAccessNav);

  await fireEvent.click(screen.getByRole('button', { name: 'Home Directory' }));
  await fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }));

  const customRadio = screen.getByRole('radio', { name: 'Use Custom Paths' });
  expect(customRadio).toBeChecked();
  expect(screen.getByRole('textbox', { name: 'Host path 1' })).toHaveValue('$SOURCES/../shared-lib');
  expect(screen.queryByText('You have unsaved changes')).not.toBeInTheDocument();
});

test('Expect browse button calls openDialog and fills host path', async () => {
  vi.mocked(window.openDialog).mockResolvedValue(['/selected/path']);

  render(AgentWorkspaceDetailsSettings, { workspaceId: 'ws-1', workspaceSummary, configuration });

  const fileAccessNav = screen.getByRole('link', { name: 'File Access' });
  await fireEvent.click(fileAccessNav);

  await fireEvent.click(screen.getByRole('button', { name: 'Browse for directory' }));

  expect(window.openDialog).toHaveBeenCalledWith({ title: 'Select a directory', selectors: ['openDirectory'] });
  expect(screen.getByRole('textbox', { name: 'Host path 1' })).toHaveValue('/selected/path');
});

test('Expect Knowledge section shows checklist with available knowledge bases', async () => {
  vi.mocked(ragStore).ragEnvironments = writable<RagEnvironment[]>([
    {
      name: 'Project Docs',
      ragConnection: { name: 'ChromaDB', providerId: 'chroma-1' },
      chunkerId: 'chunker-1',
      files: [
        { path: '/docs/api.md', status: 'indexed' },
        { path: '/docs/guide.md', status: 'indexed' },
      ],
      mcpServer: {
        id: 'rag-1',
        name: 'Project Docs MCP',
        description: '',
        url: 'http://localhost:3100/sse',
        infos: { internalProviderId: 'p1', serverId: 's1', remoteId: 1 },
        tools: {},
      },
    },
  ]);

  render(AgentWorkspaceDetailsSettings, { workspaceId: 'ws-1', workspaceSummary, configuration });

  const knowledgeNav = screen.getByRole('link', { name: 'Knowledge' });
  await fireEvent.click(knowledgeNav);

  expect(screen.getByText('Project Docs')).toBeInTheDocument();
  expect(screen.getByText('2 sources · ChromaDB')).toBeInTheDocument();
});

test('Expect Knowledge section shows empty message when no knowledge bases available', async () => {
  vi.mocked(ragStore).ragEnvironments = writable<RagEnvironment[]>([]);

  render(AgentWorkspaceDetailsSettings, { workspaceId: 'ws-1', workspaceSummary, configuration });

  const knowledgeNav = screen.getByRole('link', { name: 'Knowledge' });
  await fireEvent.click(knowledgeNav);

  expect(screen.getByText('No knowledge bases available yet.')).toBeInTheDocument();
});

test('Expect Knowledge section pre-selects knowledge matching workspace mcp config', async () => {
  vi.mocked(ragStore).ragEnvironments = writable<RagEnvironment[]>([
    {
      name: 'Project Docs',
      ragConnection: { name: 'ChromaDB', providerId: 'chroma-1' },
      chunkerId: 'chunker-1',
      files: [{ path: '/docs/api.md', status: 'indexed' }],
      mcpServer: {
        id: 'rag-1',
        name: 'Project Docs MCP',
        description: '',
        url: 'http://localhost:3100/sse',
        infos: { internalProviderId: 'p1', serverId: 's1', remoteId: 1 },
        tools: {},
      },
    },
    {
      name: 'Wiki',
      ragConnection: { name: 'Weaviate', providerId: 'weav-1' },
      chunkerId: 'chunker-2',
      files: [],
      mcpServer: {
        id: 'rag-2',
        name: 'Wiki MCP',
        description: '',
        url: 'http://localhost:3200/sse',
        infos: { internalProviderId: 'p2', serverId: 's2', remoteId: 2 },
        tools: {},
      },
    },
  ]);

  const configWithKnowledge: AgentWorkspaceConfiguration = {
    ...configuration,
    mcp: { servers: [{ name: 'Project Docs MCP', url: 'http://localhost:3100/sse' }] },
  };

  render(AgentWorkspaceDetailsSettings, { workspaceId: 'ws-1', workspaceSummary, configuration: configWithKnowledge });

  const knowledgeNav = screen.getByRole('link', { name: 'Knowledge' });
  await fireEvent.click(knowledgeNav);

  expect(screen.getByText('1 of 2 selected')).toBeInTheDocument();
});

test('Expect toggling knowledge base shows unsaved changes', async () => {
  vi.mocked(ragStore).ragEnvironments = writable<RagEnvironment[]>([
    {
      name: 'Project Docs',
      ragConnection: { name: 'ChromaDB', providerId: 'chroma-1' },
      chunkerId: 'chunker-1',
      files: [],
      mcpServer: {
        id: 'rag-1',
        name: 'Project Docs MCP',
        description: '',
        url: 'http://localhost:3100/sse',
        infos: { internalProviderId: 'p1', serverId: 's1', remoteId: 1 },
        tools: {},
      },
    },
  ]);

  render(AgentWorkspaceDetailsSettings, { workspaceId: 'ws-1', workspaceSummary, configuration });

  const knowledgeNav = screen.getByRole('link', { name: 'Knowledge' });
  await fireEvent.click(knowledgeNav);

  const itemButton = screen.getByRole('button', { name: 'Project Docs' });
  await fireEvent.click(itemButton);

  expect(screen.getByText('You have unsaved changes')).toBeInTheDocument();
});

test('Expect saving knowledge changes calls updateAgentWorkspaceConfiguration', async () => {
  vi.mocked(ragStore).ragEnvironments = writable<RagEnvironment[]>([
    {
      name: 'Project Docs',
      ragConnection: { name: 'ChromaDB', providerId: 'chroma-1' },
      chunkerId: 'chunker-1',
      files: [],
      mcpServer: {
        id: 'rag-1',
        name: 'Project Docs MCP',
        description: '',
        url: 'http://localhost:3100/sse',
        infos: { internalProviderId: 'p1', serverId: 's1', remoteId: 1 },
        tools: {},
      },
    },
  ]);

  render(AgentWorkspaceDetailsSettings, { workspaceId: 'ws-1', workspaceSummary, configuration });

  const knowledgeNav = screen.getByRole('link', { name: 'Knowledge' });
  await fireEvent.click(knowledgeNav);

  const itemButton = screen.getByRole('button', { name: 'Project Docs' });
  await fireEvent.click(itemButton);
  await fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

  expect(window.updateAgentWorkspaceConfiguration).toHaveBeenCalledWith('ws-1', {
    mcp: { servers: [{ name: 'Project Docs MCP', url: 'http://localhost:3100/sse' }] },
  });
});

test('Expect saving knowledge preserves non-knowledge MCP servers', async () => {
  vi.mocked(ragStore).ragEnvironments = writable<RagEnvironment[]>([
    {
      name: 'Project Docs',
      ragConnection: { name: 'ChromaDB', providerId: 'chroma-1' },
      chunkerId: 'chunker-1',
      files: [],
      mcpServer: {
        id: 'rag-1',
        name: 'Project Docs MCP',
        description: '',
        url: 'http://localhost:3100/sse',
        infos: { internalProviderId: 'p1', serverId: 's1', remoteId: 1 },
        tools: {},
      },
    },
  ]);

  const configWithExistingMcp: AgentWorkspaceConfiguration = {
    ...configuration,
    mcp: {
      servers: [{ name: 'GitHub MCP', url: 'https://mcp.github.com/sse' }],
      commands: [{ name: 'Local Tool', command: 'npx', args: ['tool'] }],
    },
  };

  render(AgentWorkspaceDetailsSettings, {
    workspaceId: 'ws-1',
    workspaceSummary,
    configuration: configWithExistingMcp,
  });

  const knowledgeNav = screen.getByRole('link', { name: 'Knowledge' });
  await fireEvent.click(knowledgeNav);

  const itemButton = screen.getByRole('button', { name: 'Project Docs' });
  await fireEvent.click(itemButton);
  await fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

  expect(window.updateAgentWorkspaceConfiguration).toHaveBeenCalledWith('ws-1', {
    mcp: {
      servers: [
        { name: 'GitHub MCP', url: 'https://mcp.github.com/sse' },
        { name: 'Project Docs MCP', url: 'http://localhost:3100/sse' },
      ],
      commands: [{ name: 'Local Tool', command: 'npx', args: ['tool'] }],
    },
  });
});

test('Expect discarding knowledge changes resets selection', async () => {
  vi.mocked(ragStore).ragEnvironments = writable<RagEnvironment[]>([
    {
      name: 'Project Docs',
      ragConnection: { name: 'ChromaDB', providerId: 'chroma-1' },
      chunkerId: 'chunker-1',
      files: [],
      mcpServer: {
        id: 'rag-1',
        name: 'Project Docs MCP',
        description: '',
        url: 'http://localhost:3100/sse',
        infos: { internalProviderId: 'p1', serverId: 's1', remoteId: 1 },
        tools: {},
      },
    },
  ]);

  render(AgentWorkspaceDetailsSettings, { workspaceId: 'ws-1', workspaceSummary, configuration });

  const knowledgeNav = screen.getByRole('link', { name: 'Knowledge' });
  await fireEvent.click(knowledgeNav);

  const itemButton = screen.getByRole('button', { name: 'Project Docs' });
  await fireEvent.click(itemButton);
  await fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }));

  expect(screen.getByText('No changes to save')).toBeInTheDocument();
  expect(window.updateAgentWorkspaceConfiguration).not.toHaveBeenCalled();
});

test('Expect Knowledge section has Manage Knowledges button', async () => {
  vi.mocked(ragStore).ragEnvironments = writable<RagEnvironment[]>([]);

  render(AgentWorkspaceDetailsSettings, { workspaceId: 'ws-1', workspaceSummary, configuration });

  const knowledgeNav = screen.getByRole('link', { name: 'Knowledge' });
  await fireEvent.click(knowledgeNav);

  expect(screen.getByRole('button', { name: 'Manage Knowledges' })).toBeInTheDocument();
});

test('Expect MCP section shows checklist with available servers', async () => {
  vi.mocked(mcpStore).mcpRemoteServerInfos = writable<readonly MCPRemoteServerInfo[]>([
    {
      id: 'mcp-1',
      name: 'GitHub MCP',
      description: 'Repos & PRs',
      url: 'https://mcp.github.com/sse',
      infos: { internalProviderId: 'p1', serverId: 's1', remoteId: 1 },
      tools: {},
    },
    {
      id: 'mcp-2',
      name: 'Slack MCP',
      description: 'Messaging',
      url: 'https://mcp.slack.com/sse',
      infos: { internalProviderId: 'p2', serverId: 's2', remoteId: 2 },
      tools: {},
    },
  ]);

  render(AgentWorkspaceDetailsSettings, { workspaceId: 'ws-1', workspaceSummary, configuration });

  const mcpNav = screen.getByRole('link', { name: 'MCP Servers' });
  await fireEvent.click(mcpNav);

  expect(screen.getByText('GitHub MCP')).toBeInTheDocument();
  expect(screen.getByText('Slack MCP')).toBeInTheDocument();
  expect(screen.getByText('Repos & PRs')).toBeInTheDocument();
});

test('Expect MCP section shows empty message when no servers available', async () => {
  vi.mocked(mcpStore).mcpRemoteServerInfos = writable<readonly MCPRemoteServerInfo[]>([]);

  render(AgentWorkspaceDetailsSettings, { workspaceId: 'ws-1', workspaceSummary, configuration });

  const mcpNav = screen.getByRole('link', { name: 'MCP Servers' });
  await fireEvent.click(mcpNav);

  expect(screen.getByText('No MCP servers available yet.')).toBeInTheDocument();
});

test('Expect MCP section pre-selects servers matching workspace configuration', async () => {
  vi.mocked(mcpStore).mcpRemoteServerInfos = writable<readonly MCPRemoteServerInfo[]>([
    {
      id: 'mcp-1',
      name: 'GitHub MCP',
      description: 'Repos & PRs',
      url: 'https://mcp.github.com/sse',
      infos: { internalProviderId: 'p1', serverId: 's1', remoteId: 1 },
      tools: {},
    },
    {
      id: 'mcp-2',
      name: 'Slack MCP',
      description: 'Messaging',
      url: 'https://mcp.slack.com/sse',
      infos: { internalProviderId: 'p2', serverId: 's2', remoteId: 2 },
      tools: {},
    },
  ]);

  const configWithMcp: AgentWorkspaceConfiguration = {
    ...configuration,
    mcp: { servers: [{ name: 'GitHub MCP', url: 'https://mcp.github.com/sse' }] },
  };

  render(AgentWorkspaceDetailsSettings, { workspaceId: 'ws-1', workspaceSummary, configuration: configWithMcp });

  const mcpNav = screen.getByRole('link', { name: 'MCP Servers' });
  await fireEvent.click(mcpNav);

  expect(screen.getByText('1 of 2 selected')).toBeInTheDocument();
});

test('Expect toggling MCP server shows unsaved changes', async () => {
  vi.mocked(mcpStore).mcpRemoteServerInfos = writable<readonly MCPRemoteServerInfo[]>([
    {
      id: 'mcp-1',
      name: 'GitHub MCP',
      description: 'Repos & PRs',
      url: 'https://mcp.github.com/sse',
      infos: { internalProviderId: 'p1', serverId: 's1', remoteId: 1 },
      tools: {},
    },
  ]);

  render(AgentWorkspaceDetailsSettings, { workspaceId: 'ws-1', workspaceSummary, configuration });

  const mcpNav = screen.getByRole('link', { name: 'MCP Servers' });
  await fireEvent.click(mcpNav);

  const serverButton = screen.getByRole('button', { name: 'GitHub MCP' });
  await fireEvent.click(serverButton);

  expect(screen.getByText('You have unsaved changes')).toBeInTheDocument();
});

test('Expect saving MCP changes calls updateAgentWorkspaceConfiguration', async () => {
  vi.mocked(mcpStore).mcpRemoteServerInfos = writable<readonly MCPRemoteServerInfo[]>([
    {
      id: 'mcp-1',
      name: 'GitHub MCP',
      description: 'Repos & PRs',
      url: 'https://mcp.github.com/sse',
      infos: { internalProviderId: 'p1', serverId: 's1', remoteId: 1 },
      tools: {},
    },
  ]);

  render(AgentWorkspaceDetailsSettings, { workspaceId: 'ws-1', workspaceSummary, configuration });

  const mcpNav = screen.getByRole('link', { name: 'MCP Servers' });
  await fireEvent.click(mcpNav);

  const serverButton = screen.getByRole('button', { name: 'GitHub MCP' });
  await fireEvent.click(serverButton);
  await fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

  expect(window.updateAgentWorkspaceConfiguration).toHaveBeenCalledWith('ws-1', {
    mcp: { servers: [{ name: 'GitHub MCP', url: 'https://mcp.github.com/sse' }] },
  });
});

test('Expect discarding MCP changes resets selection', async () => {
  vi.mocked(mcpStore).mcpRemoteServerInfos = writable<readonly MCPRemoteServerInfo[]>([
    {
      id: 'mcp-1',
      name: 'GitHub MCP',
      description: 'Repos & PRs',
      url: 'https://mcp.github.com/sse',
      infos: { internalProviderId: 'p1', serverId: 's1', remoteId: 1 },
      tools: {},
    },
  ]);

  render(AgentWorkspaceDetailsSettings, { workspaceId: 'ws-1', workspaceSummary, configuration });

  const mcpNav = screen.getByRole('link', { name: 'MCP Servers' });
  await fireEvent.click(mcpNav);

  const serverButton = screen.getByRole('button', { name: 'GitHub MCP' });
  await fireEvent.click(serverButton);
  await fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }));

  expect(screen.getByText('No changes to save')).toBeInTheDocument();
  expect(window.updateAgentWorkspaceConfiguration).not.toHaveBeenCalled();
});

test('Expect MCP section has Manage Servers button', async () => {
  vi.mocked(mcpStore).mcpRemoteServerInfos = writable<readonly MCPRemoteServerInfo[]>([]);

  render(AgentWorkspaceDetailsSettings, { workspaceId: 'ws-1', workspaceSummary, configuration });

  const mcpNav = screen.getByRole('link', { name: 'MCP Servers' });
  await fireEvent.click(mcpNav);

  expect(screen.getByRole('button', { name: 'Manage Servers' })).toBeInTheDocument();
});
