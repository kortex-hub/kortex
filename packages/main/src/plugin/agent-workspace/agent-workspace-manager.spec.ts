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

import { access, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type {
  Agent,
  AgentWorkspaceConfiguration,
  FileSystemWatcher,
  InferenceProviderConnection,
} from '@openkaiden/api';
import type { WebContents } from 'electron';
import type { IPty } from 'node-pty';
import { spawn } from 'node-pty';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import type { AgentRegistry } from '/@/plugin/agent-registry.js';
import * as configWriter from '/@/plugin/agent-workspace/workspace-config-writer.js';
import type { IPCHandle } from '/@/plugin/api.js';
import type { CliToolRegistry } from '/@/plugin/cli-tool-registry.js';
import type { FilesystemMonitoring } from '/@/plugin/filesystem-monitoring.js';
import { OpenshellCli } from '/@/plugin/openshell-cli/openshell-cli.js';
import type { ProviderRegistry } from '/@/plugin/provider-registry.js';
import type { SafeStorageRegistry, SecretStorageWrapper } from '/@/plugin/safe-storage/safe-storage-registry.js';
import type { SecretManager } from '/@/plugin/secret-manager/secret-manager.js';
import type { TaskManager } from '/@/plugin/tasks/task-manager.js';
import type { Task } from '/@/plugin/tasks/tasks.js';
import type { Exec } from '/@/plugin/util/exec.js';
import type { AgentWorkspaceCreateOptions } from '/@api/agent-workspace-info.js';
import type { ApiSenderType } from '/@api/api-sender/api-sender-type.js';
import type { IConfigurationRegistry } from '/@api/configuration/models.js';
import type { GatewaySandboxes } from '/@api/openshell-gateway-info.js';
import { decodeWorkspaceLabels } from '/@api/openshell-gateway-info.js';
import type { TaskState, TaskStatus } from '/@api/taskInfo.js';

import { AgentWorkspaceManager, encodeWorkspaceLabels } from './agent-workspace-manager.js';

vi.mock(import('node:fs/promises'));
vi.mock(import('yaml'));
vi.mock(import('node-pty'));

vi.mock(import('/@/plugin/openshell-cli/openshell-cli.js'));

const TEST_SUMMARIES: GatewaySandboxes[] = [
  {
    gateway: {
      name: 'kaiden',
      endpoint: 'http://localhost:10080',
    },
    sandboxes: [
      { id: 'ws-1', name: 'test-workspace-1', phase: 'Ready', sourcePath: '/tmp/ws1' },
      {
        id: 'ws-2',
        name: 'test-workspace-2',
        phase: 'Ready',
      },
    ],
  },
];

let manager: AgentWorkspaceManager;

const apiSender: ApiSenderType = {
  send: vi.fn(),
  receive: vi.fn(),
};
const ipcHandle: IPCHandle = vi.fn();
const openshellCli = new OpenshellCli({} as Exec, {} as CliToolRegistry);

const agentRegistry = {
  getAgentRegistration: vi.fn(),
} as unknown as AgentRegistry;

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
  isDestroyed: vi.fn().mockReturnValue(false),
} as unknown as WebContents;

const configurationRegistry = {
  registerConfigurations: vi.fn(),
  getConfiguration: vi.fn().mockReturnValue({
    get: vi.fn().mockReturnValue(undefined),
  }),
  getConfigurationProperties: vi.fn().mockReturnValue({}),
} as unknown as IConfigurationRegistry;

const providerRegistry = {
  getInferenceConnectionCredentials: vi.fn(),
  getInferenceConnection: vi.fn(),
} as unknown as ProviderRegistry;

const secretManager = {
  create: vi.fn(),
  init: vi.fn(),
} as unknown as SecretManager;

const extensionStorageMock = {
  get: vi.fn(),
  store: vi.fn(),
  delete: vi.fn(),
  onDidChange: vi.fn(),
} as unknown as SecretStorageWrapper;

const safeStorageRegistry = {
  getExtensionStorage: vi.fn().mockReturnValue(extensionStorageMock),
} as unknown as SafeStorageRegistry;

function mockEnoent(): NodeJS.ErrnoException {
  const err: NodeJS.ErrnoException = new Error('ENOENT');
  err.code = 'ENOENT';
  return err;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(taskManager.createTask).mockReturnValue(mockTask);
  mockTask.state = '' as TaskState;
  mockTask.status = '' as TaskStatus;
  mockTask.error = '';
  vi.mocked(filesystemMonitoring.createFileSystemWatcher).mockReturnValue(mockWatcher);
  vi.mocked(writeFile).mockResolvedValue(undefined);
  vi.mocked(readFile).mockResolvedValue('{}');
  vi.mocked(configurationRegistry.getConfiguration).mockReturnValue({
    get: vi.fn().mockReturnValue(undefined),
  } as unknown as ReturnType<IConfigurationRegistry['getConfiguration']>);
  vi.mocked(configurationRegistry.getConfigurationProperties).mockReturnValue({});
  vi.mocked(safeStorageRegistry.getExtensionStorage).mockReturnValue(extensionStorageMock);
  manager = new AgentWorkspaceManager(
    apiSender,
    ipcHandle,
    taskManager,
    filesystemMonitoring,
    webContents,
    configurationRegistry,
    providerRegistry,
    secretManager,
    openshellCli,
    safeStorageRegistry,
    agentRegistry,
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

  test('registers IPC handler for remove', () => {
    expect(ipcHandle).toHaveBeenCalledWith('agent-workspace:remove', expect.any(Function));
  });

  test('registers IPC handler for getConfiguration', () => {
    expect(ipcHandle).toHaveBeenCalledWith('agent-workspace:getConfiguration', expect.any(Function));
  });

  test('registers IPC handler for updateConfiguration', () => {
    expect(ipcHandle).toHaveBeenCalledWith('agent-workspace:updateConfiguration', expect.any(Function));
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

  test('registers defaultBaseImage configuration', () => {
    expect(configurationRegistry.registerConfigurations).toHaveBeenCalledWith([
      expect.objectContaining({
        id: 'preferences.agentWorkspace',
        properties: expect.objectContaining({
          'agentWorkspace.defaultBaseImage': expect.objectContaining({
            type: 'string',
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

describe('create – OpenShell mode', () => {
  const defaultOptions: AgentWorkspaceCreateOptions = {
    sourcePath: '/tmp/my-project',
    agent: 'claude',
    runtime: 'podman',
    name: 'my-sandbox',
  };

  const mockAgent: Agent = {
    id: 'claude',
    name: 'Claude Code',
    description: 'Test agent',
    command: 'claude',
    configurationFiles: [],
    destinationSkillsFolder: '${HOME}/.claude/skills',
    async preWorkspaceStart(): Promise<void> {},
  };

  beforeEach(() => {
    vi.mocked(openshellCli.createSandbox).mockResolvedValue(undefined);
    vi.mocked(agentRegistry.getAgentRegistration).mockReturnValue(mockAgent);
    vi.mocked(readFile).mockRejectedValue(mockEnoent());
  });

  test('calls openshellCli.createSandbox with name, providers, and workspace label', async () => {
    const options = { ...defaultOptions, secrets: ['my-secret'] };
    await manager.create(options);

    expect(openshellCli.createSandbox).toHaveBeenCalledWith({
      name: 'my-sandbox',
      providers: ['my-secret'],
      labels: encodeWorkspaceLabels('/tmp/my-project'),
      noTty: true,
      command: ['true'],
    });
  });

  test('returns { id: sandboxName }', async () => {
    const result = await manager.create(defaultOptions);

    expect(result).toEqual({ id: 'my-sandbox' });
  });

  test('derives sandbox name from sourcePath basename when name is omitted', async () => {
    const options: AgentWorkspaceCreateOptions = { sourcePath: '/tmp/my-project', agent: 'claude' };
    const result = await manager.create(options);

    expect(openshellCli.createSandbox).toHaveBeenCalledWith(expect.objectContaining({ name: 'my-project' }));
    expect(result).toEqual({ id: 'my-project' });
  });

  test('calls agent.preWorkspaceStart with correct context', async () => {
    const preWorkspaceStart = vi.fn();
    vi.mocked(agentRegistry.getAgentRegistration).mockReturnValue({ ...mockAgent, preWorkspaceStart });
    vi.mocked(providerRegistry.getInferenceConnectionCredentials).mockReturnValue({
      credentials: { 'claude:tokens': 'sk-ant-secret' },
      llmMetadataName: 'anthropic',
      endpoint: 'https://api.anthropic.com',
    });
    vi.mocked(secretManager.create).mockResolvedValue({ name: 'my-sandbox-anthropic' });

    const options = { ...defaultOptions, model: 'anthropic::claude-3-5-sonnet::' };
    await manager.create(options);

    expect(preWorkspaceStart).toHaveBeenCalledWith({
      model: {
        llmMetadata: { name: 'anthropic' },
        model: { label: 'claude-3-5-sonnet' },
        endpoint: 'https://api.anthropic.com',
      },
      configurationFiles: [],
      workspace: expect.anything(),
    });
  });

  test('uploads updated configuration files to sandbox', async () => {
    const configFile = {
      path: '/home/user/.config/agent/config.toml',
      read: vi.fn().mockResolvedValue(''),
    };
    const preWorkspaceStart = vi
      .fn()
      .mockImplementation(async (ctx: { configurationFiles: Array<{ update(c: string): Promise<void> }> }) => {
        await ctx.configurationFiles[0]!.update('key = "value"');
      });
    vi.mocked(agentRegistry.getAgentRegistration).mockReturnValue({
      ...mockAgent,
      configurationFiles: [configFile],
      preWorkspaceStart,
    });

    await manager.create(defaultOptions);

    expect(openshellCli.createSandbox).toHaveBeenCalledWith(
      expect.objectContaining({
        uploads: [{ local: expect.any(String), remote: '/home/user/.config/agent/config.toml' }],
      }),
    );
  });

  test('does not include uploads when agent has no config files', async () => {
    await manager.create(defaultOptions);

    expect(openshellCli.createSandbox).toHaveBeenCalledWith(
      expect.not.objectContaining({ uploads: expect.anything() }),
    );
  });

  test('uploads config files even when preWorkspaceStart does not update them', async () => {
    const configFile = {
      path: '/home/user/.config/agent/config.toml',
      read: vi.fn().mockResolvedValue('initial content'),
    };
    vi.mocked(agentRegistry.getAgentRegistration).mockReturnValue({
      ...mockAgent,
      configurationFiles: [configFile],
    });

    await manager.create(defaultOptions);

    expect(openshellCli.createSandbox).toHaveBeenCalledWith(
      expect.objectContaining({
        uploads: [{ local: expect.any(String), remote: '/home/user/.config/agent/config.toml' }],
      }),
    );
  });

  test('uploads selected skills into the agent destination skills folder', async () => {
    const options = {
      ...defaultOptions,
      skills: ['/home/user/.kaiden/skills/github', '/home/user/.kaiden/skills/kubernetes'],
    };

    await manager.create(options);

    expect(openshellCli.createSandbox).toHaveBeenCalledWith(
      expect.objectContaining({
        uploads: [
          { local: '/home/user/.kaiden/skills/github', remote: '.claude/skills/github' },
          { local: '/home/user/.kaiden/skills/kubernetes', remote: '.claude/skills/kubernetes' },
        ],
      }),
    );
  });

  test('resolves relative destination skills folders under the sandbox home', async () => {
    vi.mocked(agentRegistry.getAgentRegistration).mockReturnValue({
      ...mockAgent,
      destinationSkillsFolder: '.agents/skills',
    });

    await manager.create({
      ...defaultOptions,
      skills: ['/home/user/.kaiden/skills/github'],
    });

    expect(openshellCli.createSandbox).toHaveBeenCalledWith(
      expect.objectContaining({
        uploads: [{ local: '/home/user/.kaiden/skills/github', remote: '.agents/skills/github' }],
      }),
    );
  });

  test('throws when agent is not found in registry', async () => {
    vi.mocked(agentRegistry.getAgentRegistration).mockReturnValue(undefined);

    await expect(manager.create(defaultOptions)).rejects.toThrow('agent claude not registered');

    expect(openshellCli.createSandbox).not.toHaveBeenCalled();
  });

  test('calls policyUpdate twice for deny mode with hosts: remove then add', async () => {
    const options = {
      ...defaultOptions,
      network: { mode: 'deny' as const, hosts: ['registry.npmjs.org', 'pypi.python.org'] },
    };

    await manager.create(options);

    expect(openshellCli.createSandbox).toHaveBeenCalled();
    expect(openshellCli.policyUpdate).toHaveBeenCalledTimes(5);
    expect(openshellCli.policyUpdate).toHaveBeenNthCalledWith(1, {
      sandboxName: 'my-sandbox',
      removeRule: 'kdn-network',
    });
    expect(openshellCli.policyUpdate).toHaveBeenNthCalledWith(2, {
      sandboxName: 'my-sandbox',
      addEndpoints: ['registry.npmjs.org:443:full'],
      binary: '/**',
      ruleName: 'kdn-network',
      wait: true,
    });
    expect(openshellCli.policyUpdate).toHaveBeenNthCalledWith(3, {
      sandboxName: 'my-sandbox',
      addEndpoints: ['registry.npmjs.org:80:full'],
      binary: '/**',
      ruleName: 'kdn-network',
      wait: true,
    });
    expect(openshellCli.policyUpdate).toHaveBeenNthCalledWith(4, {
      sandboxName: 'my-sandbox',
      addEndpoints: ['pypi.python.org:443:full'],
      binary: '/**',
      ruleName: 'kdn-network',
      wait: true,
    });
    expect(openshellCli.policyUpdate).toHaveBeenNthCalledWith(5, {
      sandboxName: 'my-sandbox',
      addEndpoints: ['pypi.python.org:80:full'],
      binary: '/**',
      ruleName: 'kdn-network',
      wait: true,
    });
  });

  test('calls policyUpdate once for deny mode with no hosts: remove only', async () => {
    const options = { ...defaultOptions, network: { mode: 'deny' as const } };

    await manager.create(options);

    expect(openshellCli.policyUpdate).toHaveBeenCalledTimes(1);
    expect(openshellCli.policyUpdate).toHaveBeenCalledWith({
      sandboxName: 'my-sandbox',
      removeRule: 'kdn-network',
    });
  });

  test('calls policyUpdate once for deny mode with empty hosts: remove only', async () => {
    const options = { ...defaultOptions, network: { mode: 'deny' as const, hosts: [] } };

    await manager.create(options);

    expect(openshellCli.policyUpdate).toHaveBeenCalledTimes(1);
    expect(openshellCli.policyUpdate).toHaveBeenCalledWith({
      sandboxName: 'my-sandbox',
      removeRule: 'kdn-network',
    });
  });

  test('calls policyUpdate once for allow mode: remove only', async () => {
    const options = {
      ...defaultOptions,
      network: { mode: 'allow' as const, hosts: ['registry.npmjs.org'] },
    };

    await manager.create(options);

    expect(openshellCli.policyUpdate).toHaveBeenCalledTimes(1);
    expect(openshellCli.policyUpdate).toHaveBeenCalledWith({
      sandboxName: 'my-sandbox',
      removeRule: 'kdn-network',
    });
  });

  test('does not call policyUpdate when network is undefined', async () => {
    await manager.create(defaultOptions);

    expect(openshellCli.policyUpdate).not.toHaveBeenCalled();
  });

  test('swallows errors on remove-only policyUpdate', async () => {
    vi.mocked(openshellCli.policyUpdate).mockRejectedValue(new Error('rule not found'));

    const options = { ...defaultOptions, network: { mode: 'deny' as const } };

    await expect(manager.create(options)).resolves.toEqual({ id: 'my-sandbox' });
  });

  test('propagates errors on add-endpoints policyUpdate', async () => {
    vi.mocked(openshellCli.policyUpdate)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('policy update failed'));

    const options = {
      ...defaultOptions,
      network: { mode: 'deny' as const, hosts: ['registry.npmjs.org'] },
    };

    await expect(manager.create(options)).rejects.toThrow('policy update failed');
  });

  // Environment variable merging tests
  test('merges single credentialsEnvironment variable into workspace and passes to createSandbox', async () => {
    const mockConnection = { id: 'conn-1', sdk: {}, models: [] } as unknown as InferenceProviderConnection;
    vi.mocked(providerRegistry.getInferenceConnection).mockReturnValue({
      connection: mockConnection,
      extensionId: 'kaiden.vertex-ai',
    });
    vi.mocked(configurationRegistry.getConfiguration).mockReturnValue({
      get: vi.fn().mockImplementation((key: string) => {
        if (key === 'vertex-ai.connection._type') return 'google-vertex-ai';
        if (key === 'vertex-ai.connection._flags') return ['--from-gcloud-adc'];
        if (key === 'vertex-ai.connection.GOOGLE_APPLICATION_CREDENTIALS') return 'vertex-ai:conn-1:token';
        if (key === 'vertex-ai.connection.GOOGLE_VERTEX_PROJECT') return 'test-project';
        return undefined;
      }),
    } as unknown as ReturnType<IConfigurationRegistry['getConfiguration']>);
    vi.mocked(configurationRegistry.getConfigurationProperties).mockReturnValue({
      'vertex-ai.connection._type': {
        title: 'Vertex AI',
        parentId: 'vertexai',
        hidden: true,
        scope: 'InferenceProviderConnection',
        extension: { id: 'kaiden.vertex-ai' },
      },
      'vertex-ai.connection._flags': {
        title: 'Vertex AI',
        parentId: 'vertexai',
        scope: 'InferenceProviderConnection',
        extension: { id: 'kaiden.vertex-ai' },
      },
      'vertex-ai.connection.GOOGLE_APPLICATION_CREDENTIALS': {
        title: 'Vertex AI',
        parentId: 'vertexai',
        scope: 'InferenceProviderConnection',
        format: 'password',
        extension: { id: 'kaiden.vertex-ai' },
      },
      'vertex-ai.connection.GOOGLE_VERTEX_PROJECT': {
        title: 'Vertex AI',
        parentId: 'vertexai',
        scope: 'InferenceProviderConnection',
        extension: { id: 'kaiden.vertex-ai' },
      },
    });
    vi.mocked(extensionStorageMock.get).mockResolvedValue('/path/to/creds.json');
    vi.mocked(secretManager.create).mockResolvedValue({ name: 'my-sandbox-google-vertex-ai' });

    const options = { ...defaultOptions, model: 'vertexai::claude-sonnet-4::' };
    await manager.create(options);

    expect(openshellCli.createSandbox).toHaveBeenCalledWith(
      expect.objectContaining({
        env: {
          GOOGLE_VERTEX_PROJECT: 'test-project',
        },
      }),
    );
  });

  test('merges multiple credentialsEnvironment variables into workspace', async () => {
    const mockConnection = { id: 'conn-1', sdk: {}, models: [] } as unknown as InferenceProviderConnection;
    vi.mocked(providerRegistry.getInferenceConnection).mockReturnValue({
      connection: mockConnection,
      extensionId: 'kaiden.vertex-ai',
    });
    vi.mocked(configurationRegistry.getConfiguration).mockReturnValue({
      get: vi.fn().mockImplementation((key: string) => {
        if (key === 'vertex-ai.connection._type') return 'google-vertex-ai';
        if (key === 'vertex-ai.connection._flags') return ['--from-gcloud-adc'];
        if (key === 'vertex-ai.connection.GOOGLE_APPLICATION_CREDENTIALS') return 'vertex-ai:conn-1:token';
        if (key === 'vertex-ai.connection.GOOGLE_VERTEX_PROJECT') return 'multi-var-project';
        if (key === 'vertex-ai.connection.GOOGLE_VERTEX_LOCATION') return 'us-east5';
        return undefined;
      }),
    } as unknown as ReturnType<IConfigurationRegistry['getConfiguration']>);
    vi.mocked(configurationRegistry.getConfigurationProperties).mockReturnValue({
      'vertex-ai.connection._type': {
        title: 'Vertex AI',
        parentId: 'vertexai',
        hidden: true,
        scope: 'InferenceProviderConnection',
        extension: { id: 'kaiden.vertex-ai' },
      },
      'vertex-ai.connection._flags': {
        title: 'Vertex AI',
        parentId: 'vertexai',
        scope: 'InferenceProviderConnection',
        extension: { id: 'kaiden.vertex-ai' },
      },
      'vertex-ai.connection.GOOGLE_APPLICATION_CREDENTIALS': {
        title: 'Vertex AI',
        parentId: 'vertexai',
        scope: 'InferenceProviderConnection',
        format: 'password',
        extension: { id: 'kaiden.vertex-ai' },
      },
      'vertex-ai.connection.GOOGLE_VERTEX_PROJECT': {
        title: 'Vertex AI',
        parentId: 'vertexai',
        scope: 'InferenceProviderConnection',
        extension: { id: 'kaiden.vertex-ai' },
      },
      'vertex-ai.connection.GOOGLE_VERTEX_LOCATION': {
        title: 'Vertex AI',
        parentId: 'vertexai',
        scope: 'InferenceProviderConnection',
        extension: { id: 'kaiden.vertex-ai' },
      },
    });
    vi.mocked(extensionStorageMock.get).mockResolvedValue('/path/to/creds.json');
    vi.mocked(secretManager.create).mockResolvedValue({ name: 'my-sandbox-google-vertex-ai' });

    const options = { ...defaultOptions, model: 'vertexai::claude-sonnet-4::' };
    await manager.create(options);

    expect(openshellCli.createSandbox).toHaveBeenCalledWith(
      expect.objectContaining({
        env: {
          GOOGLE_VERTEX_PROJECT: 'multi-var-project',
          GOOGLE_VERTEX_LOCATION: 'us-east5',
        },
      }),
    );
  });

  test('does not pass env parameter when credentialsEnvironment is empty', async () => {
    const options = { ...defaultOptions };
    await manager.create(options);

    const call = vi.mocked(openshellCli.createSandbox).mock.calls[0]![0];
    expect(call!.env).toBeUndefined();
  });

  test('filters out empty string values from environment before createSandbox', async () => {
    vi.spyOn(configWriter, 'writeWorkspaceConfig').mockResolvedValue({
      environment: [
        { name: 'VALID_VAR', value: 'valid-value' },
        { name: 'EMPTY_VAR', value: '' },
      ],
    } as AgentWorkspaceConfiguration);

    const options = { ...defaultOptions };
    await manager.create(options);

    expect(openshellCli.createSandbox).toHaveBeenCalledWith(
      expect.objectContaining({
        env: {
          VALID_VAR: 'valid-value',
        },
      }),
    );
    const call = vi.mocked(openshellCli.createSandbox).mock.calls[0]![0];
    expect(call!.env).not.toHaveProperty('EMPTY_VAR');
  });

  test('appends credentialsEnvironment to existing workspace.environment entries', async () => {
    const mockConnection = { id: 'conn-1', sdk: {}, models: [] } as unknown as InferenceProviderConnection;
    vi.mocked(providerRegistry.getInferenceConnection).mockReturnValue({
      connection: mockConnection,
      extensionId: 'kaiden.vertex-ai',
    });
    vi.mocked(configurationRegistry.getConfiguration).mockReturnValue({
      get: vi.fn().mockImplementation((key: string) => {
        if (key === 'vertex-ai.connection._type') return 'google-vertex-ai';
        if (key === 'vertex-ai.connection._flags') return ['--from-gcloud-adc'];
        if (key === 'vertex-ai.connection.GOOGLE_APPLICATION_CREDENTIALS') return 'vertex-ai:conn-1:token';
        if (key === 'vertex-ai.connection.GOOGLE_VERTEX_PROJECT') return 'append-project';
        return undefined;
      }),
    } as unknown as ReturnType<IConfigurationRegistry['getConfiguration']>);
    vi.mocked(configurationRegistry.getConfigurationProperties).mockReturnValue({
      'vertex-ai.connection._type': {
        title: 'Vertex AI',
        parentId: 'vertexai',
        hidden: true,
        scope: 'InferenceProviderConnection',
        extension: { id: 'kaiden.vertex-ai' },
      },
      'vertex-ai.connection._flags': {
        title: 'Vertex AI',
        parentId: 'vertexai',
        scope: 'InferenceProviderConnection',
        extension: { id: 'kaiden.vertex-ai' },
      },
      'vertex-ai.connection.GOOGLE_APPLICATION_CREDENTIALS': {
        title: 'Vertex AI',
        parentId: 'vertexai',
        scope: 'InferenceProviderConnection',
        format: 'password',
        extension: { id: 'kaiden.vertex-ai' },
      },
      'vertex-ai.connection.GOOGLE_VERTEX_PROJECT': {
        title: 'Vertex AI',
        parentId: 'vertexai',
        scope: 'InferenceProviderConnection',
        extension: { id: 'kaiden.vertex-ai' },
      },
    });
    vi.mocked(extensionStorageMock.get).mockResolvedValue('/path/to/creds.json');
    vi.mocked(secretManager.create).mockResolvedValue({ name: 'my-sandbox-google-vertex-ai' });
    vi.spyOn(configWriter, 'writeWorkspaceConfig').mockResolvedValue({
      environment: [{ name: 'EXISTING_VAR', value: 'existing-value' }],
    } as AgentWorkspaceConfiguration);

    const options = { ...defaultOptions, model: 'vertexai::claude-sonnet-4::' };
    await manager.create(options);

    expect(openshellCli.createSandbox).toHaveBeenCalledWith(
      expect.objectContaining({
        env: {
          EXISTING_VAR: 'existing-value',
          GOOGLE_VERTEX_PROJECT: 'append-project',
        },
      }),
    );
  });

  test('does not pass env when all environment values are filtered out', async () => {
    vi.spyOn(configWriter, 'writeWorkspaceConfig').mockResolvedValue({
      environment: [
        { name: 'EMPTY_VAR_1', value: '' },
        { name: 'EMPTY_VAR_2', value: '' },
      ],
    } as AgentWorkspaceConfiguration);

    const options = { ...defaultOptions };
    await manager.create(options);

    const call = vi.mocked(openshellCli.createSandbox).mock.calls[0]![0];
    expect(call!.env).toBeUndefined();
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

  test('creates secret from connection config when _type and password property exist', async () => {
    const mockConnection = { id: 'conn-1', sdk: {}, models: [] } as unknown as InferenceProviderConnection;
    vi.mocked(providerRegistry.getInferenceConnection).mockReturnValue({
      connection: mockConnection,
      extensionId: 'kaiden.cursor',
    });
    vi.mocked(configurationRegistry.getConfiguration).mockReturnValue({
      get: vi.fn().mockImplementation((key: string) => {
        if (key === 'cursor.connection._type') return 'cursor';
        if (key === 'cursor.connection.token') return 'cursor:conn-1:token';
        return undefined;
      }),
    } as unknown as ReturnType<IConfigurationRegistry['getConfiguration']>);
    vi.mocked(configurationRegistry.getConfigurationProperties).mockReturnValue({
      'cursor.connection._type': {
        title: 'Cursor',
        parentId: 'cursor',
        scope: 'InferenceProviderConnection',
        hidden: true,
        extension: {
          id: 'kaiden.cursor',
        },
      },
      'cursor.connection.token': {
        title: 'Cursor',
        parentId: 'cursor',
        scope: 'InferenceProviderConnection',
        format: 'password',
        hidden: true,
        extension: {
          id: 'kaiden.cursor',
        },
      },
    });
    vi.mocked(extensionStorageMock.get).mockResolvedValue('actual-api-key');
    vi.mocked(secretManager.create).mockResolvedValue({ name: 'my-workspace-token' });

    const options = { ...baseOptions, model: 'cursor::gpt-4o::https://api.cursor.com' };
    await manager.ensureModelSecret(options);

    expect(safeStorageRegistry.getExtensionStorage).toHaveBeenCalledWith('kaiden.cursor');
    expect(extensionStorageMock.get).toHaveBeenCalledWith('cursor:conn-1:token');
    expect(secretManager.create).toHaveBeenCalledWith({
      name: 'my-workspace-cursor',
      type: 'cursor',
      value: {
        credentials: {
          token: 'actual-api-key',
        },
      },
    });
    expect(options.secrets).toContain('my-workspace-cursor');
    expect(providerRegistry.getInferenceConnectionCredentials).not.toHaveBeenCalled();
  });

  test('does not fall back when _type exists but secret value is not found', async () => {
    const mockConnection = { id: 'conn-1', sdk: {}, models: [] } as unknown as InferenceProviderConnection;
    vi.mocked(providerRegistry.getInferenceConnection).mockReturnValue({
      connection: mockConnection,
      extensionId: 'kaiden.cursor',
    });
    vi.mocked(configurationRegistry.getConfiguration).mockReturnValue({
      get: vi.fn().mockImplementation((key: string) => {
        if (key === 'cursor.connection._type') return 'cursor';
        if (key === 'cursor.connection.token') return 'cursor:conn-1:token';
        return undefined;
      }),
    } as unknown as ReturnType<IConfigurationRegistry['getConfiguration']>);
    vi.mocked(configurationRegistry.getConfigurationProperties).mockReturnValue({
      'cursor.connection._type': {
        title: 'Cursor',
        parentId: 'cursor',
        scope: 'InferenceProviderConnection',
        hidden: true,
        extension: {
          id: 'kaiden.cursor',
        },
      },
      'cursor.connection.token': {
        title: 'Cursor',
        parentId: 'cursor',
        scope: 'InferenceProviderConnection',
        format: 'password',
        hidden: true,
        extension: {
          id: 'kaiden.cursor',
        },
      },
    });
    vi.mocked(extensionStorageMock.get).mockResolvedValue(undefined);

    const options = { ...baseOptions, model: 'cursor::gpt-4o::' };
    await manager.ensureModelSecret(options);

    expect(secretManager.create).not.toHaveBeenCalled();
    expect(providerRegistry.getInferenceConnectionCredentials).not.toHaveBeenCalled();
  });

  test('derives secret name from sourcePath when name is omitted (config path)', async () => {
    const mockConnection = { id: 'conn-1', sdk: {}, models: [] } as unknown as InferenceProviderConnection;
    vi.mocked(providerRegistry.getInferenceConnection).mockReturnValue({
      connection: mockConnection,
      extensionId: 'kaiden.mistral',
    });
    vi.mocked(configurationRegistry.getConfiguration).mockReturnValue({
      get: vi.fn().mockImplementation((key: string) => {
        if (key === 'mistral.connection._type') return 'mistral';
        if (key === 'mistral.connection.token') return 'mistral:conn-1:token';
        return undefined;
      }),
    } as unknown as ReturnType<IConfigurationRegistry['getConfiguration']>);
    vi.mocked(configurationRegistry.getConfigurationProperties).mockReturnValue({
      'mistral.connection._type': {
        title: 'Mistral',
        parentId: 'mistral',
        scope: 'InferenceProviderConnection',
        hidden: true,
        extension: {
          id: 'kaiden.mistral',
        },
      },
      'mistral.connection.token': {
        title: 'Mistral',
        parentId: 'mistral',
        scope: 'InferenceProviderConnection',
        format: 'password',
        hidden: true,
        extension: {
          id: 'kaiden.mistral',
        },
      },
    });
    vi.mocked(extensionStorageMock.get).mockResolvedValue('mistral-key');
    vi.mocked(secretManager.create).mockResolvedValue({ name: 'my-project-token' });

    const options: AgentWorkspaceCreateOptions = {
      sourcePath: '/tmp/my-project',
      agent: 'coder',
      model: 'mistral::mistral-large::',
    };
    await manager.ensureModelSecret(options);

    expect(secretManager.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'my-project-mistral' }));
  });

  test('creates secret with config and flags for Vertex AI config-based path', async () => {
    const mockConnection = { id: 'conn-1', sdk: {}, models: [] } as unknown as InferenceProviderConnection;
    vi.mocked(providerRegistry.getInferenceConnection).mockReturnValue({
      connection: mockConnection,
      extensionId: 'kaiden.vertex-ai',
    });
    vi.mocked(configurationRegistry.getConfiguration).mockReturnValue({
      get: vi.fn().mockImplementation((key: string) => {
        if (key === 'vertex-ai.connection._type') return 'google-vertex-ai';
        if (key === 'vertex-ai.connection._flags') return '--from-gcloud-adc';
        if (key === 'vertex-ai.connection.GOOGLE_APPLICATION_CREDENTIALS') return 'vertex-ai:conn-1:token';
        if (key === 'vertex-ai.connection.GOOGLE_VERTEX_PROJECT') return 'my-gcp-project';
        if (key === 'vertex-ai.connection.GOOGLE_VERTEX_LOCATION') return 'us-east5';
        return undefined;
      }),
    } as unknown as ReturnType<IConfigurationRegistry['getConfiguration']>);
    vi.mocked(configurationRegistry.getConfigurationProperties).mockReturnValue({
      'vertex-ai.connection._type': {
        title: 'Vertex AI',
        parentId: 'vertex-ai',
        scope: 'InferenceProviderConnection',
        hidden: true,
        extension: { id: 'kaiden.vertex-ai' },
      },
      'vertex-ai.connection._flags': {
        title: 'Vertex AI',
        parentId: 'vertex-ai',
        scope: 'InferenceProviderConnection',
        hidden: true,
        extension: { id: 'kaiden.vertex-ai' },
      },
      'vertex-ai.connection.GOOGLE_APPLICATION_CREDENTIALS': {
        title: 'Vertex AI',
        parentId: 'vertex-ai',
        scope: 'InferenceProviderConnection',
        format: 'password',
        hidden: true,
        extension: { id: 'kaiden.vertex-ai' },
      },
      'vertex-ai.connection.GOOGLE_VERTEX_PROJECT': {
        title: 'Vertex AI',
        parentId: 'vertex-ai',
        scope: 'InferenceProviderConnection',
        hidden: true,
        extension: { id: 'kaiden.vertex-ai' },
      },
      'vertex-ai.connection.GOOGLE_VERTEX_LOCATION': {
        title: 'Vertex AI',
        parentId: 'vertex-ai',
        scope: 'InferenceProviderConnection',
        hidden: true,
        extension: { id: 'kaiden.vertex-ai' },
      },
    });
    vi.mocked(extensionStorageMock.get).mockResolvedValue('/path/to/creds.json');
    vi.mocked(secretManager.create).mockResolvedValue({ name: 'my-workspace-google-vertex-ai' });

    const options = { ...baseOptions, model: 'vertexai::claude-sonnet-4-20250514::' };
    const environment = await manager.ensureModelSecret(options);

    expect(secretManager.create).toHaveBeenCalledWith({
      name: 'my-workspace-google-vertex-ai',
      type: 'google-vertex-ai',
      value: {
        credentials: {
          GOOGLE_APPLICATION_CREDENTIALS: '/path/to/creds.json',
        },
        flags: ['--from-gcloud-adc'],
      },
    });
    expect(options.secrets).toContain('my-workspace-google-vertex-ai');
    expect(environment).toEqual({
      GOOGLE_VERTEX_PROJECT: 'my-gcp-project',
      GOOGLE_VERTEX_LOCATION: 'us-east5',
    });
    expect(providerRegistry.getInferenceConnectionCredentials).not.toHaveBeenCalled();
  });

  test('passes _flags array through unchanged when value is string[]', async () => {
    const mockConnection = { id: 'conn-1', sdk: {}, models: [] } as unknown as InferenceProviderConnection;
    vi.mocked(providerRegistry.getInferenceConnection).mockReturnValue({
      connection: mockConnection,
      extensionId: 'kaiden.vertex-ai',
    });
    vi.mocked(configurationRegistry.getConfiguration).mockReturnValue({
      get: vi.fn().mockImplementation((key: string) => {
        if (key === 'vertex-ai.connection._type') return 'google-vertex-ai';
        if (key === 'vertex-ai.connection._flags') return ['--flag-one', '--flag-two'];
        if (key === 'vertex-ai.connection.GOOGLE_APPLICATION_CREDENTIALS') return 'vertex-ai:conn-1:token';
        if (key === 'vertex-ai.connection.GOOGLE_VERTEX_PROJECT') return 'my-gcp-project';
        if (key === 'vertex-ai.connection.GOOGLE_VERTEX_LOCATION') return 'us-east5';
        return undefined;
      }),
    } as unknown as ReturnType<IConfigurationRegistry['getConfiguration']>);
    vi.mocked(configurationRegistry.getConfigurationProperties).mockReturnValue({
      'vertex-ai.connection._type': {
        title: 'Vertex AI',
        parentId: 'vertex-ai',
        scope: 'InferenceProviderConnection',
        hidden: true,
        extension: { id: 'kaiden.vertex-ai' },
      },
      'vertex-ai.connection._flags': {
        title: 'Vertex AI',
        parentId: 'vertex-ai',
        scope: 'InferenceProviderConnection',
        hidden: true,
        extension: { id: 'kaiden.vertex-ai' },
      },
      'vertex-ai.connection.GOOGLE_APPLICATION_CREDENTIALS': {
        title: 'Vertex AI',
        parentId: 'vertex-ai',
        scope: 'InferenceProviderConnection',
        format: 'password',
        hidden: true,
        extension: { id: 'kaiden.vertex-ai' },
      },
      'vertex-ai.connection.GOOGLE_VERTEX_PROJECT': {
        title: 'Vertex AI',
        parentId: 'vertex-ai',
        scope: 'InferenceProviderConnection',
        hidden: true,
        extension: { id: 'kaiden.vertex-ai' },
      },
      'vertex-ai.connection.GOOGLE_VERTEX_LOCATION': {
        title: 'Vertex AI',
        parentId: 'vertex-ai',
        scope: 'InferenceProviderConnection',
        hidden: true,
        extension: { id: 'kaiden.vertex-ai' },
      },
    });
    vi.mocked(extensionStorageMock.get).mockResolvedValue('/path/to/creds.json');
    vi.mocked(secretManager.create).mockResolvedValue({ name: 'my-workspace-google-vertex-ai' });

    const options = { ...baseOptions, model: 'vertexai::claude-sonnet-4-20250514::' };
    const environment = await manager.ensureModelSecret(options);

    expect(secretManager.create).toHaveBeenCalledWith({
      name: 'my-workspace-google-vertex-ai',
      type: 'google-vertex-ai',
      value: {
        credentials: {
          GOOGLE_APPLICATION_CREDENTIALS: '/path/to/creds.json',
        },
        flags: ['--flag-one', '--flag-two'],
      },
    });
    expect(environment).toEqual({
      GOOGLE_VERTEX_PROJECT: 'my-gcp-project',
      GOOGLE_VERTEX_LOCATION: 'us-east5',
    });
  });
});

describe('list', () => {
  test('delegates to kdnCli.list and returns items', async () => {
    vi.mocked(openshellCli.listSandboxesPerGateway).mockResolvedValue(TEST_SUMMARIES);

    const result = await manager.listOpenshellSandboxes();

    expect(openshellCli.listSandboxesPerGateway).toHaveBeenCalled();
    expect(result).toHaveLength(1);
    expect(result.flatMap(gw => gw.sandboxes).map(s => s.id)).toEqual(['ws-1', 'ws-2']);
  });

  test('rejects when kdnCli.list fails', async () => {
    vi.mocked(openshellCli.listSandboxesPerGateway).mockRejectedValue(new Error('command not found'));

    await expect(manager.listOpenshellSandboxes()).rejects.toThrow('command not found');
  });
});

describe('remove', () => {
  test('delegates to kdnCli.remove and returns the workspace id', async () => {
    vi.mocked(openshellCli.listSandboxesPerGateway).mockResolvedValue(TEST_SUMMARIES);
    vi.mocked(openshellCli.deleteSandbox).mockResolvedValue(undefined);

    const result = await manager.remove('ws-1');

    expect(openshellCli.deleteSandbox).toHaveBeenCalledWith('test-workspace-1');
    expect(result).toEqual({ id: 'ws-1' });
  });

  test('creates a task with workspace name and sets success status on completion', async () => {
    vi.mocked(openshellCli.listSandboxesPerGateway).mockResolvedValue(TEST_SUMMARIES);
    vi.mocked(openshellCli.deleteSandbox).mockResolvedValue(undefined);

    await manager.remove('ws-1');

    expect(taskManager.createTask).toHaveBeenCalledWith({ title: 'Deleting workspace "test-workspace-1"' });
    expect(mockTask.status).toBe('success');
    expect(mockTask.state).toBe('completed');
  });

  test('uses workspace id as fallback when workspace not found in list', async () => {
    vi.mocked(openshellCli.listSandboxesPerGateway).mockResolvedValue([]);
    vi.mocked(openshellCli.deleteSandbox).mockResolvedValue(undefined);

    await manager.remove('unknown-id');

    expect(taskManager.createTask).toHaveBeenCalledWith({ title: 'Deleting workspace "unknown-id"' });
  });

  test('sets task failure status when CLI fails', async () => {
    vi.mocked(openshellCli.listSandboxesPerGateway).mockResolvedValue(TEST_SUMMARIES);
    vi.mocked(openshellCli.deleteSandbox).mockRejectedValue(new Error('workspace not found: unknown-id'));

    await expect(manager.remove('unknown-id')).rejects.toThrow('workspace not found: unknown-id');

    expect(mockTask.status).toBe('failure');
    expect(mockTask.error).toContain('workspace not found: unknown-id');
    expect(mockTask.state).toBe('completed');
  });

  test('preserves error detail in task error message', async () => {
    vi.mocked(openshellCli.listSandboxesPerGateway).mockResolvedValue(TEST_SUMMARIES);
    vi.mocked(openshellCli.deleteSandbox).mockRejectedValue(new Error('failed to remove workspace: permission denied'));

    await expect(manager.remove('ws-1')).rejects.toThrow('failed to remove workspace: permission denied');

    expect(mockTask.error).toBe('Failed to delete workspace: failed to remove workspace: permission denied');
  });

  test('emits agent-workspace-update event', async () => {
    vi.mocked(openshellCli.listSandboxesPerGateway).mockResolvedValue(TEST_SUMMARIES);
    vi.mocked(openshellCli.deleteSandbox).mockResolvedValue(undefined);

    await manager.remove('ws-1');

    expect(apiSender.send).toHaveBeenCalledWith('agent-workspace-update');
  });
});

describe('getConfiguration', () => {
  test('reads JSON configuration file from workspace directory', async () => {
    vi.mocked(openshellCli.listSandboxesPerGateway).mockResolvedValue(TEST_SUMMARIES);
    vi.mocked(readFile).mockResolvedValue('{"mounts":{"dependencies":[]}}');

    const result = await manager.getConfiguration('ws-1');

    expect(openshellCli.listSandboxesPerGateway).toHaveBeenCalled();
    expect(readFile).toHaveBeenCalledWith(join('/tmp/ws1/.kaiden', 'workspace.json'), 'utf-8');
    expect(result).toEqual({ mounts: { dependencies: [] } });
  });

  test('throws when workspace id is not found in list', async () => {
    vi.mocked(openshellCli.listSandboxesPerGateway).mockResolvedValue(TEST_SUMMARIES);

    await expect(manager.getConfiguration('unknown-id')).rejects.toThrow(
      'workspace "unknown-id" not found. Use "workspace list" to see available workspaces.',
    );
  });

  test('returns empty configuration when file does not exist', async () => {
    vi.mocked(openshellCli.listSandboxesPerGateway).mockResolvedValue(TEST_SUMMARIES);
    const enoent = Object.assign(new Error('ENOENT: no such file'), { code: 'ENOENT' });
    vi.mocked(readFile).mockRejectedValue(enoent);

    const result = await manager.getConfiguration('ws-1');

    expect(result).toEqual({});
  });

  test('rejects when reading the configuration file fails with a non-ENOENT error', async () => {
    vi.mocked(openshellCli.listSandboxesPerGateway).mockResolvedValue(TEST_SUMMARIES);
    const eacces = Object.assign(new Error('EACCES: permission denied'), { code: 'EACCES' });
    vi.mocked(readFile).mockRejectedValue(eacces);

    await expect(manager.getConfiguration('ws-1')).rejects.toThrow('EACCES: permission denied');
  });
});

describe('updateConfiguration', () => {
  test('delegates to kdnCli.updateWorkspaceConfig with the workspace configuration path', async () => {
    vi.mocked(openshellCli.listSandboxesPerGateway).mockResolvedValue(TEST_SUMMARIES);
    const spy = vi.spyOn(configWriter, 'updateWorkspaceConfig');

    await manager.updateConfiguration('ws-1', { skills: ['/path/to/skill'] });

    expect(spy).toHaveBeenCalledWith(join('/tmp/ws1', '.kaiden'), { skills: ['/path/to/skill'] });
  });

  test('emits agent-workspace-update event', async () => {
    vi.mocked(openshellCli.listSandboxesPerGateway).mockResolvedValue(TEST_SUMMARIES);

    await manager.updateConfiguration('ws-1', { network: { mode: 'allow' } });

    expect(apiSender.send).toHaveBeenCalledWith('agent-workspace-update');
  });

  test('throws when workspace id is not found', async () => {
    vi.mocked(openshellCli.listSandboxesPerGateway).mockResolvedValue(TEST_SUMMARIES);

    await expect(manager.updateConfiguration('unknown-id', {})).rejects.toThrow(
      'workspace "unknown-id" not found. Use "workspace list" to see available workspaces.',
    );
  });

  test('propagates errors from kdnCli.updateWorkspaceConfig', async () => {
    vi.mocked(openshellCli.listSandboxesPerGateway).mockResolvedValue(TEST_SUMMARIES);
    vi.mocked(configWriter.updateWorkspaceConfig).mockRejectedValue(new Error('permission denied'));

    await expect(manager.updateConfiguration('ws-1', {})).rejects.toThrow('permission denied');
  });
});

describe('updateSummary', () => {
  const INSTANCES_JSON = [
    { id: 'ws-1', name: 'old-name', paths: { source: '/tmp/ws1' } },
    { id: 'ws-2', name: 'other-workspace', paths: { source: '/tmp/ws2' } },
  ];

  test('updates the name of the matching workspace in instances.json', async () => {
    vi.mocked(readFile).mockResolvedValue(JSON.stringify(INSTANCES_JSON));

    await manager.updateSummary('ws-1', { name: 'new-name' });

    expect(writeFile).toHaveBeenCalledWith(
      expect.stringMatching(/\.kdn[\\/]instances\.json$/),
      expect.any(String),
      'utf-8',
    );
    const written = JSON.parse(vi.mocked(writeFile).mock.calls[0]![1] as string) as { id: string; name: string }[];
    expect(written.find(w => w.id === 'ws-1')?.name).toBe('new-name');
    expect(written.find(w => w.id === 'ws-2')?.name).toBe('other-workspace');
  });

  test('throws when workspace id is not found', async () => {
    vi.mocked(readFile).mockResolvedValue(JSON.stringify(INSTANCES_JSON));

    await expect(manager.updateSummary('unknown-id', { name: 'x' })).rejects.toThrow(
      'workspace "unknown-id" not found in instances.json',
    );
    expect(writeFile).not.toHaveBeenCalled();
  });

  test('propagates file read errors', async () => {
    vi.mocked(readFile).mockRejectedValue(new Error('EACCES: permission denied'));

    await expect(manager.updateSummary('ws-1', { name: 'x' })).rejects.toThrow('EACCES: permission denied');
  });

  test('registers IPC handler for updateSummary', () => {
    expect(ipcHandle).toHaveBeenCalledWith('agent-workspace:updateSummary', expect.any(Function));
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
    vi.mocked(openshellCli.getCliPath).mockReturnValue('openshell');

    manager.shellInAgentWorkspace('test-workspace-1', vi.fn(), vi.fn(), vi.fn());

    expect(spawn).toHaveBeenCalledWith('openshell', ['sandbox', 'connect', 'test-workspace-1'], expect.any(Object));
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
    vi.mocked(openshellCli.listSandboxesPerGateway).mockResolvedValue(TEST_SUMMARIES);

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
    vi.mocked(openshellCli.listSandboxesPerGateway).mockResolvedValue(TEST_SUMMARIES);

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

  test('does not send terminal data when webContents is destroyed', async () => {
    vi.mocked(openshellCli.listSandboxesPerGateway).mockResolvedValue(TEST_SUMMARIES);

    let onDataCallback: ((data: string) => void) | undefined;
    let onExitCallback: (() => void) | undefined;
    const mockPty = {
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
    } as unknown as IPty;
    vi.mocked(spawn).mockReturnValue(mockPty);

    const terminalHandler = vi
      .mocked(ipcHandle)
      .mock.calls.find(call => call[0] === 'agent-workspace:terminal')?.[1] as (
      _listener: unknown,
      id: string,
      onDataId: number,
    ) => Promise<number>;

    await terminalHandler({}, 'ws-1', 1);

    vi.mocked(webContents.isDestroyed).mockReturnValue(true);

    onDataCallback!('some output');
    onExitCallback!();

    expect(webContents.send).not.toHaveBeenCalled();
  });
});

describe('encodeWorkspaceLabels', () => {
  test('returns single label for short paths', () => {
    const labels = encodeWorkspaceLabels('/tmp/my-project');
    expect(Object.keys(labels)).toEqual(['ai.openkaiden.kaiden.workspace']);
    expect(labels['ai.openkaiden.kaiden.workspace']!.length).toBeLessThanOrEqual(63);
  });

  test('splits into indexed labels for long paths', () => {
    const longPath = '/Users/fbricon/Dev/souk/ideas/stock-trading-ai/backend';
    const labels = encodeWorkspaceLabels(longPath);
    expect(labels['ai.openkaiden.kaiden.workspace']).toBeUndefined();
    expect(labels['ai.openkaiden.kaiden.workspace.0']).toBeDefined();
    expect(labels['ai.openkaiden.kaiden.workspace.1']).toBeDefined();
    for (const value of Object.values(labels)) {
      expect(value.length).toBeLessThanOrEqual(63);
    }
  });
});

describe('decodeWorkspaceLabels', () => {
  test('round-trips a short path', () => {
    const path = '/tmp/my-project';
    expect(decodeWorkspaceLabels(encodeWorkspaceLabels(path))).toBe(path);
  });

  test('round-trips a long path', () => {
    const path = '/Users/fbricon/Dev/souk/ideas/stock-trading-ai/backend';
    expect(decodeWorkspaceLabels(encodeWorkspaceLabels(path))).toBe(path);
  });

  test('returns undefined when no matching labels exist', () => {
    expect(decodeWorkspaceLabels({ unrelated: 'value' })).toBeUndefined();
  });

  test('returns undefined for non-numeric chunk suffixes', () => {
    expect(decodeWorkspaceLabels({ 'ai.openkaiden.kaiden.workspace.foo': 'abc' })).toBeUndefined();
  });

  test('returns undefined for non-contiguous chunk indices', () => {
    expect(
      decodeWorkspaceLabels({
        'ai.openkaiden.kaiden.workspace.0': 'abc',
        'ai.openkaiden.kaiden.workspace.2': 'def',
      }),
    ).toBeUndefined();
  });
});
