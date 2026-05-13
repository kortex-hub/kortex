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

import { access, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';

import type { FileSystemWatcher } from '@openkaiden/api';
import type { WebContents } from 'electron';
import type { IPty } from 'node-pty';
import { spawn } from 'node-pty';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import type { IPCHandle } from '/@/plugin/api.js';
import type { CliToolRegistry } from '/@/plugin/cli-tool-registry.js';
import type { FilesystemMonitoring } from '/@/plugin/filesystem-monitoring.js';
import { KdnCli } from '/@/plugin/kdn-cli/kdn-cli.js';
import type { ProviderRegistry } from '/@/plugin/provider-registry.js';
import type { SecretManager } from '/@/plugin/secret-manager/secret-manager.js';
import type { TaskManager } from '/@/plugin/tasks/task-manager.js';
import type { Task } from '/@/plugin/tasks/tasks.js';
import type { Exec } from '/@/plugin/util/exec.js';
import type { AgentWorkspaceCreateOptions, AgentWorkspaceSummary } from '/@api/agent-workspace-info.js';
import type { ApiSenderType } from '/@api/api-sender/api-sender-type.js';
import type { IConfigurationRegistry } from '/@api/configuration/models.js';
import type { TaskState, TaskStatus } from '/@api/taskInfo.js';

import { AgentWorkspaceManager } from './agent-workspace-manager.js';

vi.mock(import('node:fs/promises'));
vi.mock(import('yaml'));
vi.mock(import('node-pty'));

vi.mock(import('/@/plugin/kdn-cli/kdn-cli.js'));

const TEST_SUMMARIES: AgentWorkspaceSummary[] = [
  {
    id: 'ws-1',
    name: 'test-workspace-1',
    project: 'project-alpha',
    agent: 'coder-v1',
    state: 'stopped',
    model: 'gpt-4o',
    runtime: 'podman',
    paths: { source: '/tmp/ws1', configuration: '/tmp/ws1/.kaiden' },
    timestamps: { created: 1700000000 },
    forwards: [],
  },
  {
    id: 'ws-2',
    name: 'test-workspace-2',
    project: 'project-beta',
    agent: 'coder-v2',
    state: 'running',
    runtime: 'podman',
    paths: { source: '/tmp/ws2', configuration: '/tmp/ws2/.kaiden' },
    timestamps: { created: 1700000001, started: 1700000002 },
    forwards: [],
  },
];

let manager: AgentWorkspaceManager;

const apiSender: ApiSenderType = {
  send: vi.fn(),
  receive: vi.fn(),
};
const ipcHandle: IPCHandle = vi.fn();
const kdnCli = new KdnCli({} as Exec, {} as CliToolRegistry);

const mockTask = {
  id: 'task-1',
  name: 'mock-task',
  started: Date.now(),
  state: '',
  status: '',
  error: '',
  cancellable: false,
  dispose: vi.fn(),
  onUpdate: vi.fn(),
} as unknown as Task;
const taskManager = {
  createTask: vi.fn().mockReturnValue(mockTask),
} as unknown as TaskManager;

const mockWatcher = {
  onDidChange: vi.fn(),
  onDidCreate: vi.fn(),
  onDidDelete: vi.fn(),
  dispose: vi.fn(),
} as unknown as FileSystemWatcher;
const filesystemMonitoring = {
  createFileSystemWatcher: vi.fn().mockReturnValue(mockWatcher),
} as unknown as FilesystemMonitoring;

const webContents = {
  send: vi.fn(),
  receive: vi.fn(),
} as unknown as WebContents;

const configurationRegistry = {
  registerConfigurations: vi.fn(),
  getConfiguration: vi.fn().mockReturnValue({
    get: vi.fn().mockReturnValue(undefined),
  }),
} as unknown as IConfigurationRegistry;

const providerRegistry = {
  getInferenceConnectionCredentials: vi.fn(),
} as unknown as ProviderRegistry;

const secretManager = {
  create: vi.fn(),
  init: vi.fn(),
} as unknown as SecretManager;

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(taskManager.createTask).mockReturnValue(mockTask);
  mockTask.state = '' as TaskState;
  mockTask.status = '' as TaskStatus;
  mockTask.error = '';
  vi.mocked(filesystemMonitoring.createFileSystemWatcher).mockReturnValue(mockWatcher);
  vi.mocked(configurationRegistry.getConfiguration).mockReturnValue({
    get: vi.fn().mockReturnValue(undefined),
  } as unknown as ReturnType<IConfigurationRegistry['getConfiguration']>);
  manager = new AgentWorkspaceManager(
    apiSender,
    ipcHandle,
    kdnCli,
    taskManager,
    filesystemMonitoring,
    webContents,
    configurationRegistry,
    providerRegistry,
    secretManager,
  );
  manager.init();
});

describe('init', () => {
  test('registers IPC handler for checkConfigExists', () => {
    expect(ipcHandle).toHaveBeenCalledWith('agent-workspace:checkConfigExists', expect.any(Function));
  });

  test('registers IPC handler for create', () => {
    expect(ipcHandle).toHaveBeenCalledWith('agent-workspace:create', expect.any(Function));
  });

  test('registers IPC handler for list', () => {
    expect(ipcHandle).toHaveBeenCalledWith('agent-workspace:list', expect.any(Function));
  });

  test('registers IPC handler for remove', () => {
    expect(ipcHandle).toHaveBeenCalledWith('agent-workspace:remove', expect.any(Function));
  });

  test('registers IPC handler for getConfiguration', () => {
    expect(ipcHandle).toHaveBeenCalledWith('agent-workspace:getConfiguration', expect.any(Function));
  });

  test('registers IPC handler for start', () => {
    expect(ipcHandle).toHaveBeenCalledWith('agent-workspace:start', expect.any(Function));
  });

  test('registers IPC handler for stop', () => {
    expect(ipcHandle).toHaveBeenCalledWith('agent-workspace:stop', expect.any(Function));
  });

  test('registers IPC handler for getCliInfo', () => {
    expect(ipcHandle).toHaveBeenCalledWith('agent-workspace:getCliInfo', expect.any(Function));
  });

  test('registers runtime configuration with enum', () => {
    expect(configurationRegistry.registerConfigurations).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'preferences.agentWorkspace',
        properties: expect.objectContaining({
          'agentWorkspace.runtime': expect.objectContaining({
            type: 'string',
            enum: ['podman', 'openshell'],
            default: 'podman',
          }),
        }),
      }),
    ]);
  });
});

describe('watchInstancesFile', () => {
  test('watches ~/.kdn/instances.json on init', () => {
    expect(filesystemMonitoring.createFileSystemWatcher).toHaveBeenCalledWith(
      expect.stringMatching(/\.kdn[\\/]instances\.json$/),
    );
  });

  test('sends agent-workspace-update on file change', () => {
    const changeCallback = vi.mocked(mockWatcher.onDidChange).mock.calls[0]![0] as () => void;
    changeCallback();
    expect(apiSender.send).toHaveBeenCalledWith('agent-workspace-update');
  });

  test('sends agent-workspace-update on file create', () => {
    const createCallback = vi.mocked(mockWatcher.onDidCreate).mock.calls[0]![0] as () => void;
    createCallback();
    expect(apiSender.send).toHaveBeenCalledWith('agent-workspace-update');
  });

  test('sends agent-workspace-update on file delete', () => {
    const deleteCallback = vi.mocked(mockWatcher.onDidDelete).mock.calls[0]![0] as () => void;
    deleteCallback();
    expect(apiSender.send).toHaveBeenCalledWith('agent-workspace-update');
  });

  test('disposes watcher on dispose', () => {
    manager.dispose();
    expect(mockWatcher.dispose).toHaveBeenCalled();
  });
});

describe('getCliInfo', () => {
  test('delegates to kdnCli.getInfo', async () => {
    const expected = { version: '0.1.0', agents: ['claude'], runtimes: ['podman'] };
    vi.mocked(kdnCli.getInfo).mockResolvedValue(expected);

    const result = await manager.getCliInfo();

    expect(kdnCli.getInfo).toHaveBeenCalled();
    expect(result).toEqual(expected);
  });

  test('rejects when kdnCli.getInfo fails', async () => {
    vi.mocked(kdnCli.getInfo).mockRejectedValue(new Error('command not found'));

    await expect(manager.getCliInfo()).rejects.toThrow('command not found');
  });
});

describe('create', () => {
  const defaultOptions: AgentWorkspaceCreateOptions = {
    sourcePath: '/tmp/my-project',
    agent: 'claude',
    runtime: 'podman',
  };

  test('delegates to kdnCli.create and returns the workspace id', async () => {
    vi.mocked(kdnCli.createWorkspace).mockResolvedValue({ id: 'ws-new' });

    const result = await manager.create(defaultOptions);

    expect(kdnCli.createWorkspace).toHaveBeenCalledWith(defaultOptions);
    expect(result).toEqual({ id: 'ws-new' });
  });

  test('creates a task and sets success status on completion', async () => {
    vi.mocked(kdnCli.createWorkspace).mockResolvedValue({ id: 'ws-new' });

    await manager.create(defaultOptions);

    expect(taskManager.createTask).toHaveBeenCalledWith({ title: 'Creating workspace' });
    expect(mockTask.status).toBe('success');
    expect(mockTask.state).toBe('completed');
  });

  test('sets task failure status when CLI fails', async () => {
    vi.mocked(kdnCli.createWorkspace).mockRejectedValue(new Error('command not found'));

    await expect(manager.create(defaultOptions)).rejects.toThrow('command not found');

    expect(mockTask.status).toBe('failure');
    expect(mockTask.error).toContain('command not found');
    expect(mockTask.state).toBe('completed');
  });

  test('preserves error detail in task error message', async () => {
    vi.mocked(kdnCli.createWorkspace).mockRejectedValue(
      new Error('failed to create runtime instance: exit status 125'),
    );

    await expect(manager.create(defaultOptions)).rejects.toThrow('failed to create runtime instance: exit status 125');

    expect(mockTask.error).toBe('Failed to create workspace: failed to create runtime instance: exit status 125');
  });

  test('includes workspace name in task title when provided', async () => {
    vi.mocked(kdnCli.createWorkspace).mockResolvedValue({ id: 'ws-new' });

    await manager.create({ ...defaultOptions, name: 'my-workspace' });

    expect(taskManager.createTask).toHaveBeenCalledWith({ title: 'Creating workspace "my-workspace"' });
  });

  test('emits agent-workspace-update event', async () => {
    vi.mocked(kdnCli.createWorkspace).mockResolvedValue({ id: 'ws-new' });

    await manager.create(defaultOptions);

    expect(apiSender.send).toHaveBeenCalledWith('agent-workspace-update');
  });

  test('deletes existing workspace.json when replaceConfig is true', async () => {
    vi.mocked(rm).mockResolvedValue(undefined);
    vi.mocked(kdnCli.createWorkspace).mockResolvedValue({ id: 'ws-new' });

    await manager.create({ ...defaultOptions, replaceConfig: true });

    expect(rm).toHaveBeenCalledWith(join(defaultOptions.sourcePath, '.kaiden', 'workspace.json'), { force: true });
    expect(kdnCli.createWorkspace).toHaveBeenCalled();
  });

  test('does not delete workspace.json when replaceConfig is not set', async () => {
    vi.mocked(kdnCli.createWorkspace).mockResolvedValue({ id: 'ws-new' });

    await manager.create(defaultOptions);

    expect(rm).not.toHaveBeenCalled();
    expect(kdnCli.createWorkspace).toHaveBeenCalled();
  });
});

describe('checkWorkspaceConfigExists', () => {
  test('returns true when workspace.json exists', async () => {
    vi.mocked(access).mockResolvedValue(undefined);

    const result = await manager.checkWorkspaceConfigExists('/tmp/my-project');

    expect(result).toBe(true);
    expect(access).toHaveBeenCalledWith(join('/tmp/my-project', '.kaiden', 'workspace.json'));
  });

  test('returns false when workspace.json does not exist', async () => {
    vi.mocked(access).mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));

    const result = await manager.checkWorkspaceConfigExists('/tmp/my-project');

    expect(result).toBe(false);
  });
});

describe('ensureModelSecret', () => {
  const baseOptions: AgentWorkspaceCreateOptions = {
    sourcePath: '/tmp/my-project',
    agent: 'claude',
    name: 'my-workspace',
  };

  test('creates an anthropic secret when connection has single credential entry', async () => {
    vi.mocked(providerRegistry.getInferenceConnectionCredentials).mockReturnValue({
      credentials: { 'claude:tokens': 'sk-ant-secret' },
      llmMetadataName: 'anthropic',
      endpoint: undefined,
    });
    vi.mocked(secretManager.create).mockResolvedValue({ name: 'my-workspace-anthropic' });

    const options = { ...baseOptions, model: 'anthropic::claude-sonnet-4-20250514::' };
    await manager.ensureModelSecret(options);

    expect(secretManager.create).toHaveBeenCalledWith({
      name: 'my-workspace-anthropic',
      type: 'anthropic',
      value: 'sk-ant-secret',
    });
    expect(options.secrets).toContain('my-workspace-anthropic');
  });

  test('creates a gemini secret for gemini provider', async () => {
    vi.mocked(providerRegistry.getInferenceConnectionCredentials).mockReturnValue({
      credentials: { 'gemini:tokens': 'gemini-key' },
      llmMetadataName: 'gemini',
      endpoint: undefined,
    });
    vi.mocked(secretManager.create).mockResolvedValue({ name: 'my-workspace-gemini' });

    const options = { ...baseOptions, model: 'gemini::gemini-2.5-pro::' };
    await manager.ensureModelSecret(options);

    expect(secretManager.create).toHaveBeenCalledWith({
      name: 'my-workspace-gemini',
      type: 'gemini',
      value: 'gemini-key',
    });
    expect(options.secrets).toContain('my-workspace-gemini');
  });

  test('creates an openai secret with host from endpoint', async () => {
    vi.mocked(providerRegistry.getInferenceConnectionCredentials).mockReturnValue({
      credentials: { 'openai:tokens': 'sk-openai-key' },
      llmMetadataName: 'openai',
      endpoint: 'https://api.openai.com/v1',
    });
    vi.mocked(secretManager.create).mockResolvedValue({ name: 'my-workspace-openai' });

    const options = { ...baseOptions, model: 'openai::gpt-4o::https://api.openai.com/v1' };
    await manager.ensureModelSecret(options);

    expect(secretManager.create).toHaveBeenCalledWith({
      name: 'my-workspace-openai',
      type: 'other',
      value: 'sk-openai-key',
      hosts: ['api.openai.com'],
      header: 'Authorization',
      headerTemplate: 'Bearer ${value}',
    });
    expect(options.workspaceConfiguration?.environment).toEqual([{ name: 'OPENAI_API_KEY', value: 'provided' }]);
  });

  test('defaults openai host when no endpoint', async () => {
    vi.mocked(providerRegistry.getInferenceConnectionCredentials).mockReturnValue({
      credentials: { 'openai:tokens': 'sk-key' },
      llmMetadataName: 'openai',
      endpoint: undefined,
    });
    vi.mocked(secretManager.create).mockResolvedValue({ name: 'my-workspace-openai' });

    const options = { ...baseOptions, model: 'openai::gpt-4o::' };
    await manager.ensureModelSecret(options);

    expect(secretManager.create).toHaveBeenCalledWith(
      expect.objectContaining({
        hosts: ['api.openai.com'],
      }),
    );
  });

  test('creates a mistral secret with correct host', async () => {
    vi.mocked(providerRegistry.getInferenceConnectionCredentials).mockReturnValue({
      credentials: { 'mistral:tokens': 'mistral-key' },
      llmMetadataName: 'mistral',
      endpoint: undefined,
    });
    vi.mocked(secretManager.create).mockResolvedValue({ name: 'my-workspace-mistral' });

    const options = { ...baseOptions, model: 'mistral::mistral-large::' };
    await manager.ensureModelSecret(options);

    expect(secretManager.create).toHaveBeenCalledWith({
      name: 'my-workspace-mistral',
      type: 'other',
      value: 'mistral-key',
      hosts: ['api.mistral.ai'],
      header: 'Authorization',
      headerTemplate: 'Bearer ${value}',
    });
    expect(options.workspaceConfiguration?.environment).toEqual([{ name: 'MISTRAL_API_KEY', value: 'provided' }]);
  });

  test('does not add env var for anthropic provider', async () => {
    vi.mocked(providerRegistry.getInferenceConnectionCredentials).mockReturnValue({
      credentials: { 'claude:tokens': 'sk-ant-key' },
      llmMetadataName: 'anthropic',
      endpoint: undefined,
    });
    vi.mocked(secretManager.create).mockResolvedValue({ name: 'my-workspace-anthropic' });

    const options = { ...baseOptions, model: 'anthropic::claude-sonnet-4-20250514::' };
    await manager.ensureModelSecret(options);

    expect(options.workspaceConfiguration).toBeUndefined();
  });

  test('deduplicates env var if already present in workspaceConfiguration', async () => {
    vi.mocked(providerRegistry.getInferenceConnectionCredentials).mockReturnValue({
      credentials: { 'mistral:tokens': 'mistral-key' },
      llmMetadataName: 'mistral',
      endpoint: undefined,
    });
    vi.mocked(secretManager.create).mockResolvedValue({ name: 'my-workspace-mistral' });

    const options = {
      ...baseOptions,
      model: 'mistral::mistral-large::',
      workspaceConfiguration: { environment: [{ name: 'MISTRAL_API_KEY', value: 'old' }] },
    } as AgentWorkspaceCreateOptions;
    await manager.ensureModelSecret(options);

    expect(options.workspaceConfiguration?.environment).toEqual([{ name: 'MISTRAL_API_KEY', value: 'provided' }]);
  });

  test('skips when no model is provided', async () => {
    const options = { ...baseOptions, model: undefined };
    await manager.ensureModelSecret(options);

    expect(providerRegistry.getInferenceConnectionCredentials).not.toHaveBeenCalled();
    expect(secretManager.create).not.toHaveBeenCalled();
  });

  test('skips when workspaceConfiguration already has secrets (e.g. onboarding)', async () => {
    const options = {
      ...baseOptions,
      model: 'anthropic::claude-sonnet-4-20250514::',
      workspaceConfiguration: { secrets: ['anthropic'] },
    } as AgentWorkspaceCreateOptions;
    await manager.ensureModelSecret(options);

    expect(providerRegistry.getInferenceConnectionCredentials).not.toHaveBeenCalled();
    expect(secretManager.create).not.toHaveBeenCalled();
  });

  test('skips when connection cannot be resolved', async () => {
    vi.mocked(providerRegistry.getInferenceConnectionCredentials).mockReturnValue(undefined);

    const options = { ...baseOptions, model: 'unknown::model::' };
    await manager.ensureModelSecret(options);

    expect(secretManager.create).not.toHaveBeenCalled();
  });

  test('skips when credentials map is empty (local provider)', async () => {
    vi.mocked(providerRegistry.getInferenceConnectionCredentials).mockReturnValue({
      credentials: {},
      llmMetadataName: 'ollama',
      endpoint: 'http://localhost:11434/v1',
    });

    const options = { ...baseOptions, model: 'ollama::llama3::http://localhost:11434/v1' };
    await manager.ensureModelSecret(options);

    expect(secretManager.create).not.toHaveBeenCalled();
  });

  test('applies Vertex AI workspace configuration instead of creating a secret', async () => {
    vi.mocked(providerRegistry.getInferenceConnectionCredentials).mockReturnValue({
      credentials: { projectId: 'my-project', region: 'us-east5', credentialsFile: '/path/to/creds.json' },
      llmMetadataName: 'vertexai',
      endpoint: undefined,
    });

    const options = { ...baseOptions, model: 'vertexai::claude-sonnet-4-20250514::' };
    await manager.ensureModelSecret(options);

    expect(secretManager.create).not.toHaveBeenCalled();
    expect(options.workspaceConfiguration?.environment).toEqual([
      { name: 'CLAUDE_CODE_USE_VERTEX', value: '1' },
      { name: 'CLOUD_ML_REGION', value: 'us-east5' },
      { name: 'ANTHROPIC_VERTEX_PROJECT_ID', value: 'my-project' },
    ]);
    expect(options.workspaceConfiguration?.mounts).toEqual([
      { host: '/path/to/creds.json', target: '$HOME/.config/gcloud/application_default_credentials.json', ro: true },
    ]);
  });

  test('deduplicates Vertex AI env vars when workspaceConfiguration already has entries', async () => {
    vi.mocked(providerRegistry.getInferenceConnectionCredentials).mockReturnValue({
      credentials: { projectId: 'my-project', region: 'us-east5', credentialsFile: '/path/to/creds.json' },
      llmMetadataName: 'vertexai',
      endpoint: undefined,
    });

    const options = {
      ...baseOptions,
      model: 'vertexai::claude-sonnet-4-20250514::',
      workspaceConfiguration: {
        environment: [
          { name: 'CLOUD_ML_REGION', value: 'old-region' },
          { name: 'OTHER_VAR', value: 'keep' },
        ],
        mounts: [
          { host: '/old/creds.json', target: '$HOME/.config/gcloud/application_default_credentials.json', ro: true },
        ],
      },
    } as AgentWorkspaceCreateOptions;
    await manager.ensureModelSecret(options);

    expect(options.workspaceConfiguration?.environment).toEqual([
      { name: 'OTHER_VAR', value: 'keep' },
      { name: 'CLAUDE_CODE_USE_VERTEX', value: '1' },
      { name: 'CLOUD_ML_REGION', value: 'us-east5' },
      { name: 'ANTHROPIC_VERTEX_PROJECT_ID', value: 'my-project' },
    ]);
    expect(options.workspaceConfiguration?.mounts).toEqual([
      { host: '/path/to/creds.json', target: '$HOME/.config/gcloud/application_default_credentials.json', ro: true },
    ]);
  });

  test('replaces tilde with $HOME in Vertex AI credentials file path', async () => {
    vi.mocked(providerRegistry.getInferenceConnectionCredentials).mockReturnValue({
      credentials: {
        projectId: 'my-project',
        region: 'us-east5',
        credentialsFile: '~/.config/gcloud/application_default_credentials.json',
      },
      llmMetadataName: 'vertexai',
      endpoint: undefined,
    });

    const options = { ...baseOptions, model: 'vertexai::claude-sonnet-4-20250514::' };
    await manager.ensureModelSecret(options);

    expect(options.workspaceConfiguration?.mounts).toEqual([
      {
        host: '$HOME/.config/gcloud/application_default_credentials.json',
        target: '$HOME/.config/gcloud/application_default_credentials.json',
        ro: true,
      },
    ]);
  });

  test('skips Vertex AI config when credentials are incomplete', async () => {
    vi.mocked(providerRegistry.getInferenceConnectionCredentials).mockReturnValue({
      credentials: { projectId: 'my-project', region: '', credentialsFile: '' },
      llmMetadataName: 'vertexai',
      endpoint: undefined,
    });

    const options = { ...baseOptions, model: 'vertexai::claude-sonnet-4-20250514::' };
    await manager.ensureModelSecret(options);

    expect(options.workspaceConfiguration).toBeUndefined();
  });

  test('skips when llmMetadataName is unknown', async () => {
    vi.mocked(providerRegistry.getInferenceConnectionCredentials).mockReturnValue({
      credentials: { token: 'some-key' },
      llmMetadataName: 'unknown-provider',
      endpoint: undefined,
    });

    const options = { ...baseOptions, model: 'unknown-provider::model::' };
    await manager.ensureModelSecret(options);

    expect(secretManager.create).not.toHaveBeenCalled();
  });

  test('tolerates "already exists" error from secret creation', async () => {
    vi.mocked(providerRegistry.getInferenceConnectionCredentials).mockReturnValue({
      credentials: { 'claude:tokens': 'sk-ant-secret' },
      llmMetadataName: 'anthropic',
      endpoint: undefined,
    });
    vi.mocked(secretManager.create).mockRejectedValue(new Error('secret already exists: my-workspace-anthropic'));

    const options = { ...baseOptions, model: 'anthropic::claude-sonnet-4-20250514::' };
    await manager.ensureModelSecret(options);

    expect(options.secrets).toContain('my-workspace-anthropic');
  });

  test('rethrows non-"already exists" errors from secret creation', async () => {
    vi.mocked(providerRegistry.getInferenceConnectionCredentials).mockReturnValue({
      credentials: { 'claude:tokens': 'sk-ant-secret' },
      llmMetadataName: 'anthropic',
      endpoint: undefined,
    });
    vi.mocked(secretManager.create).mockRejectedValue(new Error('keychain unavailable'));

    const options = { ...baseOptions, model: 'anthropic::claude-sonnet-4-20250514::' };
    await expect(manager.ensureModelSecret(options)).rejects.toThrow('keychain unavailable');
  });

  test('merges secret name with existing secrets', async () => {
    vi.mocked(providerRegistry.getInferenceConnectionCredentials).mockReturnValue({
      credentials: { 'claude:tokens': 'sk-ant-secret' },
      llmMetadataName: 'anthropic',
      endpoint: undefined,
    });
    vi.mocked(secretManager.create).mockResolvedValue({ name: 'my-workspace-anthropic' });

    const options = { ...baseOptions, model: 'anthropic::claude-sonnet-4-20250514::', secrets: ['github-token'] };
    await manager.ensureModelSecret(options);

    expect(options.secrets).toEqual(['github-token', 'my-workspace-anthropic']);
  });

  test('derives secret name from sourcePath when name is omitted', async () => {
    vi.mocked(providerRegistry.getInferenceConnectionCredentials).mockReturnValue({
      credentials: { 'claude:tokens': 'sk-ant-secret' },
      llmMetadataName: 'anthropic',
      endpoint: undefined,
    });
    vi.mocked(secretManager.create).mockResolvedValue({ name: 'my-project-anthropic' });

    const options: AgentWorkspaceCreateOptions = {
      sourcePath: '/tmp/my-project',
      agent: 'claude',
      model: 'anthropic::claude-sonnet-4-20250514::',
    };
    await manager.ensureModelSecret(options);

    expect(secretManager.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'my-project-anthropic' }));
    expect(options.secrets).toContain('my-project-anthropic');
  });

  test('does not duplicate secret name if already present', async () => {
    vi.mocked(providerRegistry.getInferenceConnectionCredentials).mockReturnValue({
      credentials: { 'claude:tokens': 'sk-ant-secret' },
      llmMetadataName: 'anthropic',
      endpoint: undefined,
    });
    vi.mocked(secretManager.create).mockResolvedValue({ name: 'my-workspace-anthropic' });

    const options = {
      ...baseOptions,
      model: 'anthropic::claude-sonnet-4-20250514::',
      secrets: ['my-workspace-anthropic'],
    };
    await manager.ensureModelSecret(options);

    expect(options.secrets).toEqual(['my-workspace-anthropic']);
  });
});

describe('buildSecretOptions', () => {
  test('returns undefined when credentials value is empty', () => {
    const result = manager.buildSecretOptions(
      { credentials: { key: '' }, llmMetadataName: 'anthropic', endpoint: undefined },
      'ws',
    );
    expect(result).toBeUndefined();
  });

  test('returns undefined for unknown provider', () => {
    const result = manager.buildSecretOptions(
      { credentials: { key: 'value' }, llmMetadataName: 'somethingElse', endpoint: undefined },
      'ws',
    );
    expect(result).toBeUndefined();
  });

  test('derives secret name from workspace name and provider', () => {
    const result = manager.buildSecretOptions(
      { credentials: { key: 'value' }, llmMetadataName: 'anthropic', endpoint: undefined },
      'my-project',
    );
    expect(result?.secret.name).toBe('my-project-anthropic');
  });

  test('does not include environmentVariable for anthropic', () => {
    const result = manager.buildSecretOptions(
      { credentials: { key: 'value' }, llmMetadataName: 'anthropic', endpoint: undefined },
      'ws',
    );
    expect(result?.environmentVariable).toBeUndefined();
  });

  test('treats undefined provider as openai-compatible with endpoint host', () => {
    const result = manager.buildSecretOptions(
      { credentials: { key: 'sk-key' }, llmMetadataName: undefined, endpoint: 'https://my-llm.example.com/v1' },
      'ws',
    );
    expect(result).toEqual({
      secret: {
        name: 'ws-secret',
        type: 'other',
        value: 'sk-key',
        hosts: ['my-llm.example.com'],
        header: 'Authorization',
        headerTemplate: 'Bearer ${value}',
      },
      environmentVariable: { name: 'OPENAI_API_KEY', value: 'provided' },
    });
  });

  test('treats undefined provider as openai-compatible defaulting host to api.openai.com', () => {
    const result = manager.buildSecretOptions(
      { credentials: { key: 'sk-key' }, llmMetadataName: undefined, endpoint: undefined },
      'ws',
    );
    expect(result).toEqual({
      secret: {
        name: 'ws-secret',
        type: 'other',
        value: 'sk-key',
        hosts: ['api.openai.com'],
        header: 'Authorization',
        headerTemplate: 'Bearer ${value}',
      },
      environmentVariable: { name: 'OPENAI_API_KEY', value: 'provided' },
    });
  });

  test('includes MISTRAL_API_KEY env var for mistral provider', () => {
    const result = manager.buildSecretOptions(
      { credentials: { key: 'mistral-key' }, llmMetadataName: 'mistral', endpoint: undefined },
      'ws',
    );
    expect(result?.environmentVariable).toEqual({ name: 'MISTRAL_API_KEY', value: 'provided' });
  });
});

describe('list', () => {
  test('delegates to kdnCli.list and returns items', async () => {
    vi.mocked(kdnCli.listWorkspaces).mockResolvedValue(TEST_SUMMARIES);

    const result = await manager.list();

    expect(kdnCli.listWorkspaces).toHaveBeenCalled();
    expect(result).toHaveLength(2);
    expect(result.map(s => s.id)).toEqual(['ws-1', 'ws-2']);
  });

  test('rejects when kdnCli.list fails', async () => {
    vi.mocked(kdnCli.listWorkspaces).mockRejectedValue(new Error('command not found'));

    await expect(manager.list()).rejects.toThrow('command not found');
  });
});

describe('remove', () => {
  test('delegates to kdnCli.remove and returns the workspace id', async () => {
    vi.mocked(kdnCli.removeWorkspaces).mockResolvedValue({ id: 'ws-1' });

    const result = await manager.remove('ws-1');

    expect(kdnCli.removeWorkspaces).toHaveBeenCalledWith('ws-1');
    expect(result).toEqual({ id: 'ws-1' });
  });

  test('creates a task and sets success status on completion', async () => {
    vi.mocked(kdnCli.removeWorkspaces).mockResolvedValue({ id: 'ws-1' });

    await manager.remove('ws-1');

    expect(taskManager.createTask).toHaveBeenCalledWith({ title: 'Deleting workspace ws-1' });
    expect(mockTask.status).toBe('success');
    expect(mockTask.state).toBe('completed');
  });

  test('sets task failure status when CLI fails', async () => {
    vi.mocked(kdnCli.removeWorkspaces).mockRejectedValue(new Error('workspace not found: unknown-id'));

    await expect(manager.remove('unknown-id')).rejects.toThrow('workspace not found: unknown-id');

    expect(mockTask.status).toBe('failure');
    expect(mockTask.error).toContain('workspace not found: unknown-id');
    expect(mockTask.state).toBe('completed');
  });

  test('preserves error detail in task error message', async () => {
    vi.mocked(kdnCli.removeWorkspaces).mockRejectedValue(new Error('failed to remove workspace: permission denied'));

    await expect(manager.remove('ws-1')).rejects.toThrow('failed to remove workspace: permission denied');

    expect(mockTask.error).toBe('Failed to delete workspace: failed to remove workspace: permission denied');
  });

  test('emits agent-workspace-update event', async () => {
    vi.mocked(kdnCli.removeWorkspaces).mockResolvedValue({ id: 'ws-1' });

    await manager.remove('ws-1');

    expect(apiSender.send).toHaveBeenCalledWith('agent-workspace-update');
  });
});

describe('getConfiguration', () => {
  test('reads JSON configuration file from workspace directory', async () => {
    vi.mocked(kdnCli.listWorkspaces).mockResolvedValue(TEST_SUMMARIES);
    vi.mocked(readFile).mockResolvedValue('{"mounts":{"dependencies":[]}}');

    const result = await manager.getConfiguration('ws-1');

    expect(kdnCli.listWorkspaces).toHaveBeenCalled();
    expect(readFile).toHaveBeenCalledWith(join('/tmp/ws1/.kaiden', 'workspace.json'), 'utf-8');
    expect(result).toEqual({ mounts: { dependencies: [] } });
  });

  test('throws when workspace id is not found in list', async () => {
    vi.mocked(kdnCli.listWorkspaces).mockResolvedValue(TEST_SUMMARIES);

    await expect(manager.getConfiguration('unknown-id')).rejects.toThrow(
      'workspace "unknown-id" not found. Use "workspace list" to see available workspaces.',
    );
  });

  test('returns empty configuration when file does not exist', async () => {
    vi.mocked(kdnCli.listWorkspaces).mockResolvedValue(TEST_SUMMARIES);
    const enoent = Object.assign(new Error('ENOENT: no such file'), { code: 'ENOENT' });
    vi.mocked(readFile).mockRejectedValue(enoent);

    const result = await manager.getConfiguration('ws-1');

    expect(result).toEqual({});
  });

  test('rejects when reading the configuration file fails with a non-ENOENT error', async () => {
    vi.mocked(kdnCli.listWorkspaces).mockResolvedValue(TEST_SUMMARIES);
    const eacces = Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' });
    vi.mocked(readFile).mockRejectedValue(eacces);

    await expect(manager.getConfiguration('ws-1')).rejects.toThrow('EACCES: permission denied');
  });
});

describe('start', () => {
  test('delegates to kdnCli.start and returns the workspace id', async () => {
    vi.mocked(kdnCli.startWorkspace).mockResolvedValue({ id: 'ws-1' });

    const result = await manager.start('ws-1');

    expect(kdnCli.startWorkspace).toHaveBeenCalledWith('ws-1');
    expect(result).toEqual({ id: 'ws-1' });
  });

  test('emits agent-workspace-update event', async () => {
    vi.mocked(kdnCli.startWorkspace).mockResolvedValue({ id: 'ws-1' });

    await manager.start('ws-1');

    expect(apiSender.send).toHaveBeenCalledWith('agent-workspace-update');
  });

  test('rejects when kdnCli.start fails', async () => {
    vi.mocked(kdnCli.startWorkspace).mockRejectedValue(new Error('workspace not found: unknown-id'));

    await expect(manager.start('unknown-id')).rejects.toThrow('workspace not found: unknown-id');
  });
});

describe('stop', () => {
  test('delegates to kdnCli.stop and returns the workspace id', async () => {
    vi.mocked(kdnCli.stopWorkspace).mockResolvedValue({ id: 'ws-1' });

    const result = await manager.stop('ws-1');

    expect(kdnCli.stopWorkspace).toHaveBeenCalledWith('ws-1');
    expect(result).toEqual({ id: 'ws-1' });
  });

  test('emits agent-workspace-update event', async () => {
    vi.mocked(kdnCli.stopWorkspace).mockResolvedValue({ id: 'ws-1' });

    await manager.stop('ws-1');

    expect(apiSender.send).toHaveBeenCalledWith('agent-workspace-update');
  });

  test('rejects when kdnCli.stop fails', async () => {
    vi.mocked(kdnCli.stopWorkspace).mockRejectedValue(new Error('workspace not found: unknown-id'));

    await expect(manager.stop('unknown-id')).rejects.toThrow('workspace not found: unknown-id');
  });
});

describe('shellInAgentWorkspace', () => {
  let onDataCallback: ((data: string) => void) | undefined;
  let onExitCallback: (() => void) | undefined;

  function createMockPty(): IPty {
    onDataCallback = undefined;
    onExitCallback = undefined;
    return {
      onData: vi.fn((cb: (data: string) => void) => {
        onDataCallback = cb;
        return { dispose: vi.fn() };
      }),
      onExit: vi.fn((cb: () => void) => {
        onExitCallback = cb;
        return { dispose: vi.fn() };
      }),
      write: vi.fn(),
      resize: vi.fn(),
      kill: vi.fn(),
      pid: 123,
      cols: 80,
      rows: 24,
      process: 'kdn',
      handleFlowControl: false,
      pause: vi.fn(),
      resume: vi.fn(),
      clear: vi.fn(),
    } as unknown as IPty;
  }

  test('returns write, resize, and ptyProcess', () => {
    vi.mocked(spawn).mockReturnValue(createMockPty());

    const result = manager.shellInAgentWorkspace('test-workspace-1', vi.fn(), vi.fn(), vi.fn());

    expect(result).toHaveProperty('write');
    expect(result).toHaveProperty('resize');
    expect(result).toHaveProperty('ptyProcess');
  });

  test('spawns kdn terminal with workspace name', () => {
    vi.mocked(spawn).mockReturnValue(createMockPty());
    vi.mocked(kdnCli.getCliPath).mockReturnValue('kdn');

    manager.shellInAgentWorkspace('test-workspace-1', vi.fn(), vi.fn(), vi.fn());

    expect(spawn).toHaveBeenCalledWith('kdn', ['terminal', 'test-workspace-1'], expect.any(Object));
  });

  test('write function forwards data to pty', () => {
    const mockPty = createMockPty();
    vi.mocked(spawn).mockReturnValue(mockPty);

    const result = manager.shellInAgentWorkspace('test-workspace-1', vi.fn(), vi.fn(), vi.fn());
    result.write('hello');

    expect(mockPty.write).toHaveBeenCalledWith('hello');
  });

  test('resize function forwards dimensions to pty', () => {
    const mockPty = createMockPty();
    vi.mocked(spawn).mockReturnValue(mockPty);

    const result = manager.shellInAgentWorkspace('test-workspace-1', vi.fn(), vi.fn(), vi.fn());
    result.resize(120, 40);

    expect(mockPty.resize).toHaveBeenCalledWith(120, 40);
  });

  test('calls onData when pty emits data', () => {
    vi.mocked(spawn).mockReturnValue(createMockPty());

    const onData = vi.fn();
    manager.shellInAgentWorkspace('test-workspace-1', onData, vi.fn(), vi.fn());

    expect(onDataCallback).toBeDefined();
    onDataCallback!('output');

    expect(onData).toHaveBeenCalledWith('output');
  });

  test('calls onEnd when pty exits', () => {
    vi.mocked(spawn).mockReturnValue(createMockPty());

    const onEnd = vi.fn();
    manager.shellInAgentWorkspace('test-workspace-1', vi.fn(), vi.fn(), onEnd);

    expect(onExitCallback).toBeDefined();
    onExitCallback!();

    expect(onEnd).toHaveBeenCalled();
  });
});

describe('dispose', () => {
  test('kills active terminal processes', async () => {
    vi.mocked(kdnCli.listWorkspaces).mockResolvedValue(TEST_SUMMARIES);

    const mockPty = {
      onData: vi.fn(() => ({ dispose: vi.fn() })),
      onExit: vi.fn(() => ({ dispose: vi.fn() })),
      write: vi.fn(),
      resize: vi.fn(),
      kill: vi.fn(),
      pid: 123,
    } as unknown as IPty;
    vi.mocked(spawn).mockReturnValue(mockPty);

    const terminalHandler = vi
      .mocked(ipcHandle)
      .mock.calls.find(call => call[0] === 'agent-workspace:terminal')?.[1] as (
      _listener: unknown,
      id: string,
      onDataId: number,
    ) => Promise<number>;
    expect(terminalHandler).toBeDefined();

    await terminalHandler({}, 'ws-1', 1);

    manager.dispose();

    expect(mockPty.kill).toHaveBeenCalled();
  });

  test('terminal IPC handler rejects when workspace id is not found', async () => {
    vi.mocked(kdnCli.listWorkspaces).mockResolvedValue(TEST_SUMMARIES);

    const terminalHandler = vi
      .mocked(ipcHandle)
      .mock.calls.find(call => call[0] === 'agent-workspace:terminal')?.[1] as (
      _listener: unknown,
      id: string,
      onDataId: number,
    ) => Promise<number>;
    expect(terminalHandler).toBeDefined();

    await expect(terminalHandler({}, 'unknown-id', 1)).rejects.toThrow(
      'workspace "unknown-id" not found. Use "workspace list" to see available workspaces.',
    );
  });
});
