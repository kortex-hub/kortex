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

import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { beforeEach, expect, test, vi } from 'vitest';

import type { IPCHandle } from '/@/plugin/api.js';
import type { Directories } from '/@/plugin/directories.js';
import type { MCPManager } from '/@/plugin/mcp/mcp-manager.js';
import type { RagEnvironmentRegistry } from '/@/plugin/rag-environment-registry.js';
import type { SecretManager } from '/@/plugin/secret-manager/secret-manager.js';
import type { SkillManager } from '/@/plugin/skill/skill-manager.js';
import type { ApiSenderType } from '/@api/api-sender/api-sender-type.js';
import type { WorkspaceProjectCreateOptions, WorkspaceProjectInfo } from '/@api/workspace-project-info.js';

import { WorkspaceProjectManager } from './workspace-project-manager.js';

vi.mock('node:fs');
vi.mock('node:fs/promises');

const PROJECTS_DIR = resolve('/test/workspace-projects');

const receiveCallbacks = new Map<string, (...args: unknown[]) => void>();

const apiSender: ApiSenderType = {
  send: vi.fn(),
  receive: vi.fn().mockImplementation((channel: string, callback: (...args: unknown[]) => void) => {
    receiveCallbacks.set(channel, callback);
    return { dispose: vi.fn() };
  }),
};

const ipcHandle: IPCHandle = vi.fn();

const directories = {
  getWorkspaceProjectsDirectory: vi.fn().mockReturnValue(PROJECTS_DIR),
} as unknown as Directories;

const skillManager = {
  listSkills: vi.fn().mockReturnValue([
    { name: 'skill-a', description: 'Skill A', path: '/skills/a', enabled: true, managed: true },
    { name: 'skill-b', description: 'Skill B', path: '/skills/b', enabled: true, managed: true },
  ]),
} as unknown as SkillManager;

const mcpManager = {
  listMCPRemoteServers: vi.fn().mockResolvedValue([
    { id: 'mcp-1', name: 'mcp-server-a', description: '', url: '', tools: {} },
    { id: 'mcp-2', name: 'mcp-server-b', description: '', url: '', tools: {} },
  ]),
} as unknown as MCPManager;

const secretManager = {
  list: vi.fn().mockResolvedValue([
    { name: 'secret-a', type: 'generic' },
    { name: 'secret-b', type: 'generic' },
  ]),
} as unknown as SecretManager;

const ragEnvironmentRegistry = {
  getAllRagEnvironments: vi.fn().mockResolvedValue([{ name: 'knowledge-a' }, { name: 'knowledge-b' }]),
} as unknown as RagEnvironmentRegistry;

function createManager(): WorkspaceProjectManager {
  return new WorkspaceProjectManager(
    apiSender,
    ipcHandle,
    directories,
    skillManager,
    mcpManager,
    secretManager,
    ragEnvironmentRegistry,
  );
}

const sampleCreateOptions: WorkspaceProjectCreateOptions = {
  name: 'My Project',
  folder: '/home/user/project',
  skills: ['skill-a'],
  mcpServers: ['mcp-1'],
  knowledges: [],
  secrets: ['secret-a'],
  filesystem: { mode: 'allow', mounts: [] },
  network: { mode: 'deny' },
};

const sampleProject: WorkspaceProjectInfo = {
  id: 'existing-id',
  ...sampleCreateOptions,
};

function mockEmptyDir(): void {
  vi.mocked(existsSync).mockReturnValue(true);
  vi.mocked(readdir).mockResolvedValue([] as never);
}

function mockDirWithProject(...projects: WorkspaceProjectInfo[]): void {
  vi.mocked(existsSync).mockReturnValue(true);
  vi.mocked(readdir).mockResolvedValue(projects.map(p => `${p.id}.json`) as never);
  vi.mocked(readFile).mockImplementation(async (path: unknown) => {
    const project = projects.find(p => (path as string).includes(p.id));
    if (project) {
      return JSON.stringify(project);
    }
    throw new Error(`File not found: ${path}`);
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  receiveCallbacks.clear();

  vi.mocked(apiSender.receive).mockImplementation((channel: string, callback: (...args: unknown[]) => void) => {
    receiveCallbacks.set(channel, callback);
    return { dispose: vi.fn() };
  });

  vi.mocked(directories.getWorkspaceProjectsDirectory).mockReturnValue(PROJECTS_DIR);

  vi.mocked(skillManager.listSkills).mockReturnValue([
    { name: 'skill-a', description: 'Skill A', path: '/skills/a', enabled: true, managed: true },
    { name: 'skill-b', description: 'Skill B', path: '/skills/b', enabled: true, managed: true },
  ]);

  vi.mocked(mcpManager.listMCPRemoteServers).mockResolvedValue([
    { id: 'mcp-1', name: 'mcp-server-a', description: '', url: '', tools: {} },
    { id: 'mcp-2', name: 'mcp-server-b', description: '', url: '', tools: {} },
  ] as never);

  vi.mocked(secretManager.list).mockResolvedValue([
    { name: 'secret-a', type: 'generic' },
    { name: 'secret-b', type: 'generic' },
  ] as never);

  vi.mocked(ragEnvironmentRegistry.getAllRagEnvironments).mockResolvedValue([
    { name: 'knowledge-a' },
    { name: 'knowledge-b' },
  ] as never);
});

test('init creates projects directory if it does not exist', async () => {
  vi.mocked(existsSync).mockReturnValue(false);
  const manager = createManager();

  await manager.init();

  expect(mkdir).toHaveBeenCalledWith(PROJECTS_DIR, { recursive: true });
});

test('init does not create directory if it already exists', async () => {
  mockEmptyDir();
  const manager = createManager();

  await manager.init();

  expect(mkdir).not.toHaveBeenCalled();
});

test('init registers all IPC handlers', async () => {
  mockEmptyDir();
  const manager = createManager();

  await manager.init();

  expect(ipcHandle).toHaveBeenCalledWith('workspace-project-manager:list', expect.any(Function));
  expect(ipcHandle).toHaveBeenCalledWith('workspace-project-manager:get', expect.any(Function));
  expect(ipcHandle).toHaveBeenCalledWith('workspace-project-manager:create', expect.any(Function));
  expect(ipcHandle).toHaveBeenCalledWith('workspace-project-manager:remove', expect.any(Function));
  expect(ipcHandle).toHaveBeenCalledWith('workspace-project-manager:update', expect.any(Function));
});

test('init loads projects from disk into cache', async () => {
  const project2: WorkspaceProjectInfo = { ...sampleProject, id: 'project-2', name: 'Second' };
  mockDirWithProject(sampleProject, project2);
  const manager = createManager();

  await manager.init();

  const result = manager.list();
  expect(result).toHaveLength(2);
  expect(result.find(p => p.id === 'existing-id')).toEqual(sampleProject);
  expect(result.find(p => p.id === 'project-2')).toEqual(project2);
});

test('init skips non-JSON files when loading from disk', async () => {
  vi.mocked(existsSync).mockReturnValue(true);
  vi.mocked(readdir).mockResolvedValue(['project-1.json', 'readme.txt'] as never);
  vi.mocked(readFile).mockResolvedValue(JSON.stringify(sampleProject));

  const manager = createManager();
  await manager.init();

  expect(readFile).toHaveBeenCalledTimes(1);
  expect(readFile).not.toHaveBeenCalledWith(join(PROJECTS_DIR, 'readme.txt'), 'utf-8');
});

test('list returns empty array when no projects loaded', async () => {
  vi.mocked(existsSync).mockReturnValue(false);
  const manager = createManager();
  await manager.init();

  expect(manager.list()).toEqual([]);
});

test('list returns cached projects without reading from disk', async () => {
  mockDirWithProject(sampleProject);
  const manager = createManager();
  await manager.init();

  vi.mocked(readFile).mockClear();

  const result = manager.list();

  expect(result).toHaveLength(1);
  expect(result[0]).toEqual(sampleProject);
  expect(readFile).not.toHaveBeenCalled();
});

test('get returns a project from cache by id', async () => {
  mockDirWithProject(sampleProject);
  const manager = createManager();
  await manager.init();

  const result = manager.get('existing-id');

  expect(result).toEqual(sampleProject);
});

test('get throws when project not found in cache', async () => {
  mockEmptyDir();
  const manager = createManager();
  await manager.init();

  expect(() => manager.get('missing')).toThrow('Workspace project "missing" not found');
});

test('create generates id, writes file, updates cache, and sends event', async () => {
  mockEmptyDir();
  const manager = createManager();
  await manager.init();

  const result = await manager.create(sampleCreateOptions);

  expect(result.id).toBe('My Project');
  expect(result.name).toBe('My Project');
  expect(writeFile).toHaveBeenCalledWith(join(PROJECTS_DIR, 'My Project.json'), expect.any(String), 'utf-8');
  expect(apiSender.send).toHaveBeenCalledWith('workspace-project-update');
  expect(manager.get('My Project')).toEqual(result);
});

test('create validates skill references', async () => {
  mockEmptyDir();
  const manager = createManager();
  await manager.init();

  await expect(manager.create({ ...sampleCreateOptions, skills: ['unknown-skill'] })).rejects.toThrow(
    'Unknown skills: unknown-skill',
  );
});

test('create validates MCP server references', async () => {
  mockEmptyDir();
  const manager = createManager();
  await manager.init();

  await expect(manager.create({ ...sampleCreateOptions, mcpServers: ['unknown-server'] })).rejects.toThrow(
    'Unknown MCP servers: unknown-server',
  );
});

test('create validates secret references', async () => {
  mockEmptyDir();
  const manager = createManager();
  await manager.init();

  await expect(manager.create({ ...sampleCreateOptions, secrets: ['unknown-secret'] })).rejects.toThrow(
    'Unknown secrets: unknown-secret',
  );
});

test('create validates knowledge references', async () => {
  mockEmptyDir();
  const manager = createManager();
  await manager.init();

  await expect(manager.create({ ...sampleCreateOptions, knowledges: ['unknown-knowledge'] })).rejects.toThrow(
    'Unknown knowledges: unknown-knowledge',
  );
});

test('create reports all validation errors at once', async () => {
  mockEmptyDir();
  const manager = createManager();
  await manager.init();

  await expect(
    manager.create({
      ...sampleCreateOptions,
      skills: ['bad-skill'],
      mcpServers: ['bad-server'],
      secrets: ['bad-secret'],
      knowledges: ['bad-knowledge'],
    }),
  ).rejects.toThrow(
    'Unknown skills: bad-skill; Unknown MCP servers: bad-server; Unknown secrets: bad-secret; Unknown knowledges: bad-knowledge',
  );
});

test('remove deletes file, removes from cache, and sends event', async () => {
  mockDirWithProject(sampleProject);
  const manager = createManager();
  await manager.init();

  await manager.remove('existing-id');

  expect(rm).toHaveBeenCalledWith(join(PROJECTS_DIR, 'existing-id.json'));
  expect(apiSender.send).toHaveBeenCalledWith('workspace-project-update');
  expect(manager.list()).toEqual([]);
});

test('remove throws when project not found in cache', async () => {
  mockEmptyDir();
  const manager = createManager();
  await manager.init();

  await expect(manager.remove('missing')).rejects.toThrow('Workspace project "missing" not found');
});

test('update merges options, writes file, updates cache, and sends event', async () => {
  mockDirWithProject(sampleProject);
  const manager = createManager();
  await manager.init();

  const result = await manager.update('existing-id', { name: 'Updated Name' });

  expect(result.id).toBe('existing-id');
  expect(result.name).toBe('Updated Name');
  expect(result.folder).toBe(sampleProject.folder);
  expect(writeFile).toHaveBeenCalled();
  expect(apiSender.send).toHaveBeenCalledWith('workspace-project-update');
  expect(manager.get('existing-id').name).toBe('Updated Name');
});

test('update validates references after merge', async () => {
  mockDirWithProject(sampleProject);
  const manager = createManager();
  await manager.init();

  await expect(manager.update('existing-id', { skills: ['nonexistent'] })).rejects.toThrow(
    'Unknown skills: nonexistent',
  );
});

test('init removes invalid skill references from loaded projects', async () => {
  const projectWithBadSkill: WorkspaceProjectInfo = {
    ...sampleProject,
    skills: ['skill-a', 'deleted-skill'],
  };
  mockDirWithProject(projectWithBadSkill);
  const manager = createManager();

  await manager.init();

  const loaded = manager.get('existing-id');
  expect(loaded.skills).toEqual(['skill-a']);
  expect(writeFile).toHaveBeenCalledWith(join(PROJECTS_DIR, 'existing-id.json'), expect.any(String), 'utf-8');
});

test('init removes invalid MCP server references from loaded projects', async () => {
  const projectWithBadServer: WorkspaceProjectInfo = {
    ...sampleProject,
    mcpServers: ['mcp-1', 'deleted-server'],
  };
  mockDirWithProject(projectWithBadServer);
  const manager = createManager();

  await manager.init();

  const loaded = manager.get('existing-id');
  expect(loaded.mcpServers).toEqual(['mcp-1']);
  expect(writeFile).toHaveBeenCalled();
});

test('init removes invalid secret references from loaded projects', async () => {
  const projectWithBadSecret: WorkspaceProjectInfo = {
    ...sampleProject,
    secrets: ['secret-a', 'deleted-secret'],
  };
  mockDirWithProject(projectWithBadSecret);
  const manager = createManager();

  await manager.init();

  const loaded = manager.get('existing-id');
  expect(loaded.secrets).toEqual(['secret-a']);
  expect(writeFile).toHaveBeenCalled();
});

test('init removes invalid knowledge references from loaded projects', async () => {
  const projectWithBadKnowledge: WorkspaceProjectInfo = {
    ...sampleProject,
    knowledges: ['knowledge-a', 'deleted-knowledge'],
  };
  mockDirWithProject(projectWithBadKnowledge);
  const manager = createManager();

  await manager.init();

  const loaded = manager.get('existing-id');
  expect(loaded.knowledges).toEqual(['knowledge-a']);
  expect(writeFile).toHaveBeenCalled();
});

test('init does not write to disk when all references are valid', async () => {
  mockDirWithProject(sampleProject);
  const manager = createManager();

  await manager.init();

  expect(writeFile).not.toHaveBeenCalled();
});

test('init removes all invalid references at once and persists', async () => {
  const projectWithAllBad: WorkspaceProjectInfo = {
    ...sampleProject,
    skills: ['skill-a', 'gone-skill'],
    mcpServers: ['gone-server-id'],
    secrets: ['secret-a', 'gone-secret'],
    knowledges: ['knowledge-a', 'gone-knowledge'],
  };
  mockDirWithProject(projectWithAllBad);
  const manager = createManager();

  await manager.init();

  const loaded = manager.get('existing-id');
  expect(loaded.skills).toEqual(['skill-a']);
  expect(loaded.mcpServers).toEqual([]);
  expect(loaded.secrets).toEqual(['secret-a']);
  expect(loaded.knowledges).toEqual(['knowledge-a']);
});

test('create skips validation for empty reference arrays', async () => {
  mockEmptyDir();
  const manager = createManager();
  await manager.init();

  const result = await manager.create({
    ...sampleCreateOptions,
    skills: [],
    mcpServers: [],
    secrets: [],
  });

  expect(result.id).toBe('My Project');
  expect(skillManager.listSkills).not.toHaveBeenCalled();
  expect(mcpManager.listMCPRemoteServers).not.toHaveBeenCalled();
  expect(secretManager.list).not.toHaveBeenCalled();
  expect(ragEnvironmentRegistry.getAllRagEnvironments).not.toHaveBeenCalled();
});

test('init subscribes to all external update events', async () => {
  mockEmptyDir();
  const manager = createManager();

  await manager.init();

  expect(receiveCallbacks.has('skill-manager-update')).toBe(true);
  expect(receiveCallbacks.has('mcp-manager-update')).toBe(true);
  expect(receiveCallbacks.has('secret-manager-update')).toBe(true);
  expect(receiveCallbacks.has('rag-environment-created')).toBe(true);
  expect(receiveCallbacks.has('rag-environment-updated')).toBe(true);
  expect(receiveCallbacks.has('rag-environment-deleted')).toBe(true);
});

test('skill-manager-update event sanitizes cached projects', async () => {
  mockDirWithProject(sampleProject);
  const manager = createManager();
  await manager.init();

  vi.mocked(skillManager.listSkills).mockReturnValue([]);
  vi.mocked(writeFile).mockClear();
  vi.mocked(apiSender.send).mockClear();

  receiveCallbacks.get('skill-manager-update')!();
  await vi.waitFor(() => {
    expect(apiSender.send).toHaveBeenCalledWith('workspace-project-update');
  });

  expect(manager.get('existing-id').skills).toEqual([]);
  expect(writeFile).toHaveBeenCalled();
});

test('mcp-manager-update event sanitizes cached projects', async () => {
  mockDirWithProject(sampleProject);
  const manager = createManager();
  await manager.init();

  vi.mocked(mcpManager.listMCPRemoteServers).mockResolvedValue([] as never);
  vi.mocked(writeFile).mockClear();
  vi.mocked(apiSender.send).mockClear();

  receiveCallbacks.get('mcp-manager-update')!();
  await vi.waitFor(() => {
    expect(apiSender.send).toHaveBeenCalledWith('workspace-project-update');
  });

  expect(manager.get('existing-id').mcpServers).toEqual([]);
});

test('secret-manager-update event sanitizes cached projects', async () => {
  mockDirWithProject(sampleProject);
  const manager = createManager();
  await manager.init();

  vi.mocked(secretManager.list).mockResolvedValue([] as never);
  vi.mocked(writeFile).mockClear();
  vi.mocked(apiSender.send).mockClear();

  receiveCallbacks.get('secret-manager-update')!();
  await vi.waitFor(() => {
    expect(apiSender.send).toHaveBeenCalledWith('workspace-project-update');
  });

  expect(manager.get('existing-id').secrets).toEqual([]);
});

test('rag-environment-deleted event sanitizes cached projects', async () => {
  const projectWithKnowledge: WorkspaceProjectInfo = {
    ...sampleProject,
    knowledges: ['knowledge-a'],
  };
  mockDirWithProject(projectWithKnowledge);
  const manager = createManager();
  await manager.init();

  vi.mocked(ragEnvironmentRegistry.getAllRagEnvironments).mockResolvedValue([] as never);
  vi.mocked(writeFile).mockClear();
  vi.mocked(apiSender.send).mockClear();

  receiveCallbacks.get('rag-environment-deleted')!();
  await vi.waitFor(() => {
    expect(apiSender.send).toHaveBeenCalledWith('workspace-project-update');
  });

  expect(manager.get('existing-id').knowledges).toEqual([]);
  expect(writeFile).toHaveBeenCalled();
});

test('external update event does not notify when no references changed', async () => {
  mockDirWithProject(sampleProject);
  const manager = createManager();
  await manager.init();

  vi.mocked(apiSender.send).mockClear();

  receiveCallbacks.get('skill-manager-update')!();
  await vi.waitFor(() => {
    expect(skillManager.listSkills).toHaveBeenCalled();
  });

  expect(apiSender.send).not.toHaveBeenCalledWith('workspace-project-update');
});

test('dispose cleans up event subscriptions', async () => {
  mockEmptyDir();
  const manager = createManager();
  await manager.init();

  manager.dispose();

  const disposeFns = vi.mocked(apiSender.receive).mock.results.map(r => r.value.dispose);
  for (const disposeFn of disposeFns) {
    expect(disposeFn).toHaveBeenCalled();
  }
});
