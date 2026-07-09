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

import { access, lstat, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { basename, isAbsolute, join, posix, resolve } from 'node:path';

import type { Disposable, FileSystemWatcher } from '@openkaiden/api';
import type { WebContents } from 'electron';
import { inject, injectable, preDestroy } from 'inversify';
import { dump } from 'js-yaml';
import type { IPty } from 'node-pty';
import { spawn } from 'node-pty';

import { AgentRegistry } from '/@/plugin/agent-registry.js';
import { updateWorkspaceConfig, writeWorkspaceConfig } from '/@/plugin/agent-workspace/workspace-config-writer.js';
import { WritableConfigurationFile } from '/@/plugin/agent-workspace/writable-configuration-file.js';
import { IPCHandle, WebContentsType } from '/@/plugin/api.js';
import { FilesystemMonitoring } from '/@/plugin/filesystem-monitoring.js';
import { OpenshellCli } from '/@/plugin/openshell-cli/openshell-cli.js';
import { OpenshellGateway } from '/@/plugin/openshell-cli/openshell-gateway.js';
import { buildPolicyObject, rewriteLocalhostUrl } from '/@/plugin/openshell-cli/openshell-network-policy.js';
import { ProviderRegistry } from '/@/plugin/provider-registry.js';
import { SecretManager } from '/@/plugin/secret-manager/secret-manager.js';
import { TaskManager } from '/@/plugin/tasks/task-manager.js';
import { AgentWorkspaceSettings } from '/@api/agent-workspace/agent-workspace-settings.js';
import type {
  AgentWorkspaceConfiguration,
  AgentWorkspaceCreateOptions,
  AgentWorkspaceId,
  AgentWorkspaceSummary,
} from '/@api/agent-workspace-info.js';
import { ApiSenderType } from '/@api/api-sender/api-sender-type.js';
import type { IConfigurationNode } from '/@api/configuration/models.js';
import { IConfigurationRegistry } from '/@api/configuration/models.js';
import type { GatewaySandboxes } from '/@api/openshell-gateway-info.js';
import { AGENT_LABEL, decodeWorkspaceLabels, WORKSPACE_LABEL } from '/@api/openshell-gateway-info.js';

const HOME_VARIABLE = '${HOME}';
const LABEL_MAX_LENGTH = 63;
const SOURCES_VARIABLE = '$SOURCES';
const MOUNT_HOME_PREFIX = '$HOME';

type OpenshellUpload = { local: string; remote: string };

export function encodeWorkspaceLabels(sourcePath: string): Record<string, string> {
  const encoded = Buffer.from(sourcePath).toString('base64url');
  if (encoded.length <= LABEL_MAX_LENGTH) {
    return { [WORKSPACE_LABEL]: encoded };
  }
  const labels: Record<string, string> = {};
  for (let i = 0, chunk = 0; i < encoded.length; i += LABEL_MAX_LENGTH, chunk++) {
    labels[`${WORKSPACE_LABEL}.${chunk}`] = encoded.slice(i, i + LABEL_MAX_LENGTH);
  }
  return labels;
}

/**
 * Manages agent workspaces by delegating to the `kdn` CLI.
 */
@injectable()
export class AgentWorkspaceManager implements Disposable {
  private instancesWatcher: FileSystemWatcher | undefined;
  private readonly terminalCallbacks = new Map<
    number,
    { write: (param: string) => void; resize: (w: number, h: number) => void }
  >();
  private readonly terminalProcesses = new Map<number, IPty>();
  private readonly commandExecutedWorkspaces = new Set<string>();

  constructor(
    @inject(ApiSenderType)
    private readonly apiSender: ApiSenderType,
    @inject(IPCHandle)
    private readonly ipcHandle: IPCHandle,
    @inject(TaskManager)
    private readonly taskManager: TaskManager,
    @inject(FilesystemMonitoring)
    private readonly filesystemMonitoring: FilesystemMonitoring,
    @inject(WebContentsType)
    private readonly webContents: WebContents,
    @inject(IConfigurationRegistry)
    private readonly configurationRegistry: IConfigurationRegistry,
    @inject(ProviderRegistry)
    private readonly providerRegistry: ProviderRegistry,
    @inject(SecretManager)
    private readonly secretManager: SecretManager,
    @inject(OpenshellCli)
    private readonly openshellCli: OpenshellCli,
    @inject(AgentRegistry)
    private readonly agentRegistry: AgentRegistry,
    @inject(OpenshellGateway)
    private readonly openshellGateway: OpenshellGateway,
  ) {}

  async create(options: AgentWorkspaceCreateOptions): Promise<AgentWorkspaceId> {
    const suffix = options.name ? ` "${options.name}"` : '';
    const task = this.taskManager.createTask({ title: `Creating workspace${suffix}` });
    task.state = 'running';
    task.status = 'in-progress';
    try {
      if (!options.model) {
        throw new Error('model is required to create a workspace');
      }

      if (options.replaceConfig) {
        const configPath = join(options.sourcePath, '.kaiden', 'workspace.json');
        await rm(configPath, { force: true });
      }

      const secretName = await this.ensureModelSecret(options);
      const workspaceId = await this.createOpenshell(options, secretName);
      this.apiSender.send('agent-workspace-update');
      task.status = 'success';
      return workspaceId;
    } catch (err: unknown) {
      const detail = err instanceof Error ? err.message : String(err);
      task.status = 'failure';
      task.error = `Failed to create workspace: ${detail}`;
      throw new Error(detail);
    } finally {
      task.state = 'completed';
    }
  }

  private async createOpenshell(options: AgentWorkspaceCreateOptions, secretName?: string): Promise<AgentWorkspaceId> {
    const connectionInfo = this.providerRegistry.getInferenceConnectionCredentials(options.model);

    const modelName = options.model.split('::')[1] ?? '';
    const rawEndpoint = connectionInfo?.endpoint ?? options.model.split('::')[2] ?? undefined;
    const endpoint = rawEndpoint ? rewriteLocalhostUrl(rawEndpoint) : undefined;

    const workspace = await writeWorkspaceConfig(options);
    const agent = this.agentRegistry.getAgentRegistration(options.agent);
    const uploads: OpenshellUpload[] = [];

    if (agent) {
      const writable = await Promise.all(
        agent.configurationFiles.map(
          async (base, i) =>
            new WritableConfigurationFile(base, await base.read(), join(tmpdir(), `kaiden-config-${Date.now()}-${i}`)),
        ),
      );

      await agent.preWorkspaceStart({
        model: {
          llmMetadata: connectionInfo?.llmMetadataName ? { name: connectionInfo.llmMetadataName } : undefined,
          model: { label: modelName ?? '' },
          endpoint,
        },
        configurationFiles: writable,
        workspace,
      });

      for (const file of writable) {
        await writeFile(file.localPath, await file.read(), 'utf-8');
        uploads.push({ local: file.localPath, remote: file.path });
      }

      const skillUploads = await this.buildOpenshellSkillUploads(options.skills, agent.destinationSkillsFolder);
      uploads.push(...skillUploads);
    } else {
      throw new Error(`Unable to create workspace: agent ${options.agent} not registered`);
    }

    if (secretName !== undefined) {
      const connection = this.providerRegistry.getInferenceConnection(options.model);
      if (connection) {
        const provider = this.providerRegistry.getProvider(connection?.providerId);
        const { connectionProperties } = this.secretManager.getConnectionProperties(connection.connection, provider);
        const hasFlags = connectionProperties.find(([fullKey]) => fullKey.endsWith('._flags'));
        if (hasFlags) {
          await this.openshellCli.setInference({
            provider: secretName,
            model: modelName,
          });
        }
      }
    }

    uploads.push(...(await this.buildOpenshellFilesystemUploads(options.sourcePath, workspace)));

    const sandboxName = options.name ?? basename(options.sourcePath);
    const env = workspace.environment
      ?.filter(entry => typeof entry.value === 'string' && entry.value !== '')
      .reduce<Record<string, string>>((acc, entry) => {
        acc[entry.name] = entry.value as string;
        return acc;
      }, {});
    const dedupedUploads = this.dedupeOpenshellUploads(uploads);

    const t0 = performance.now();

    const policy = buildPolicyObject(workspace.network, endpoint);
    let policyFile: string | undefined;
    if (policy) {
      policyFile = join(tmpdir(), `kaiden-policy-${sandboxName}-${Date.now()}.yaml`);
      await writeFile(policyFile, dump(policy), 'utf-8');
    }

    try {
      await this.openshellCli.createSandbox({
        name: sandboxName,
        providers: options.secrets,
        env: env && Object.keys(env).length > 0 ? env : undefined,
        labels: { ...encodeWorkspaceLabels(options.sourcePath), [AGENT_LABEL]: options.agent },
        uploads: dedupedUploads.length > 0 ? dedupedUploads : undefined,
        noTty: true,
        command: ['true'],
        policy: policyFile,
      });
    } finally {
      if (policyFile) {
        await rm(policyFile, { force: true }).catch(() => {});
      }
    }

    const tSandbox = performance.now();
    console.log(`[workspace-timing] createSandbox: ${(tSandbox - t0).toFixed(0)}ms`);

    const v2Globally = await this.openshellCli.isV2ProviderEnabled();
    if (!v2Globally) {
      await this.openshellCli.enableV2Provider(sandboxName);
    }

    const tV2 = performance.now();
    console.log(`[workspace-timing] enableV2Provider: ${(tV2 - tSandbox).toFixed(0)}ms`);
    console.log(`[workspace-timing] total createOpenshell: ${(tV2 - t0).toFixed(0)}ms`);

    return { id: sandboxName };
  }

  async checkWorkspaceConfigExists(sourcePath: string): Promise<boolean> {
    try {
      await access(join(sourcePath, '.kaiden', 'workspace.json'));
      return true;
    } catch {
      return false;
    }
  }

  private async buildOpenshellSkillUploads(
    skills: string[] | undefined,
    destinationSkillsFolder: string,
  ): Promise<OpenshellUpload[]> {
    if (!skills?.length) {
      return [];
    }

    const remoteBase = this.resolveOpenshellSkillsDestination(destinationSkillsFolder);
    const resolved = await Promise.all(skills.map(skillPath => realpath(skillPath)));
    return resolved.map(local => ({ local, remote: remoteBase }));
  }

  private async buildOpenshellFilesystemUploads(
    sourcePath: string,
    workspace: AgentWorkspaceConfiguration,
  ): Promise<OpenshellUpload[]> {
    const uploads: OpenshellUpload[] = [{ local: sourcePath, remote: '.' }];

    for (const mount of workspace.mounts ?? []) {
      const local = this.resolveHostPath(mount.host, sourcePath);
      const remote = this.resolveOpenshellSandboxPath(mount.target, sourcePath);
      if (!local || !remote) {
        continue;
      }
      const resolvedRemote = await this.resolveUploadRemotePath(local, remote);
      uploads.push({ local, remote: resolvedRemote });
    }
    return uploads;
  }

  private async resolveUploadRemotePath(local: string, remote: string): Promise<string> {
    try {
      const stats = await lstat(local);
      if (stats.isDirectory()) {
        const localBase = basename(local);
        if (localBase !== '' && posix.basename(remote) === localBase) {
          return posix.dirname(remote);
        }
      }
    } catch {
      // Leave remote unchanged when the local path cannot be inspected.
    }
    return remote;
  }

  private resolveHostPath(path: string, sourcePath: string): string | undefined {
    if (path === SOURCES_VARIABLE) {
      return sourcePath;
    }
    if (path.startsWith(`${SOURCES_VARIABLE}/`)) {
      return resolve(sourcePath, path.slice(SOURCES_VARIABLE.length + 1));
    }
    if (path === MOUNT_HOME_PREFIX) {
      return homedir();
    }
    if (path.startsWith(`${MOUNT_HOME_PREFIX}/`)) {
      return resolve(homedir(), path.slice(MOUNT_HOME_PREFIX.length + 1));
    }
    if (path.startsWith('~/')) {
      return resolve(homedir(), path.slice(2));
    }
    if (isAbsolute(path)) {
      return path;
    }
    return undefined;
  }

  private resolveOpenshellSandboxPath(path: string, _sourcePath: string): string | undefined {
    if (path === SOURCES_VARIABLE) {
      return '.';
    }
    if (path.startsWith(`${SOURCES_VARIABLE}/`)) {
      return path.slice(SOURCES_VARIABLE.length + 1);
    }
    if (path === MOUNT_HOME_PREFIX) {
      return '~';
    }
    if (path.startsWith(`${MOUNT_HOME_PREFIX}/`)) {
      return posix.join('~', path.slice(MOUNT_HOME_PREFIX.length + 1));
    }
    if (path.startsWith('/')) {
      return path;
    }
    return undefined;
  }

  private dedupeOpenshellUploads(uploads: OpenshellUpload[]): OpenshellUpload[] {
    const deduped: OpenshellUpload[] = [];
    const seen = new Set<string>();
    for (const upload of uploads) {
      const key = `${upload.local}\u0000${upload.remote}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      deduped.push(upload);
    }
    return deduped;
  }

  private resolveOpenshellSkillsDestination(destinationSkillsFolder: string): string {
    if (destinationSkillsFolder === HOME_VARIABLE) {
      return '.';
    }

    for (const str of [`${HOME_VARIABLE}/`, '~/']) {
      if (destinationSkillsFolder.startsWith(str)) {
        return destinationSkillsFolder.slice(str.length);
      }
    }

    if (destinationSkillsFolder.includes('..')) {
      throw new Error(`Invalid destination skills folder: ${destinationSkillsFolder}`);
    }

    return destinationSkillsFolder;
  }

  /**
   * Return the secret related to the inference connection linked to the
   * model. Return undefined if there is no secret associated with this connection
·   */
  async ensureModelSecret(options: AgentWorkspaceCreateOptions): Promise<string | undefined> {
    if (options.workspaceConfiguration?.secrets?.length) {
      return undefined;
    }

    return this.ensureModelSecretFromConfig(options);
  }

  private async ensureModelSecretFromConfig(options: AgentWorkspaceCreateOptions): Promise<string | undefined> {
    const secret = await this.secretManager.ensureSecretForModel(options.model);
    if (!secret) return undefined;

    options.secrets = [...new Set([...(options.secrets ?? []), secret.name])];

    return secret.name;
  }

  async remove(id: string): Promise<AgentWorkspaceId> {
    const workspaces = await this.listOpenshellSandboxes();
    const workspace = workspaces.flatMap(gw => gw.sandboxes).find(ws => ws.id === id);
    const workspaceName = workspace?.name ?? id;
    const task = this.taskManager.createTask({ title: `Deleting workspace "${workspaceName}"` });
    task.state = 'running';
    task.status = 'in-progress';
    try {
      await this.openshellCli.deleteSandbox(workspaceName);
      this.commandExecutedWorkspaces.delete(id);
      this.apiSender.send('agent-workspace-update');
      task.status = 'success';
      return { id };
    } catch (err: unknown) {
      const detail = err instanceof Error ? err.message : String(err);
      task.status = 'failure';
      task.error = `Failed to delete workspace: ${detail}`;
      throw new Error(detail);
    } finally {
      task.state = 'completed';
    }
  }

  async getConfiguration(id: string): Promise<AgentWorkspaceConfiguration> {
    const workspaces = await this.listOpenshellSandboxes();
    const workspace = workspaces.flatMap(gw => gw.sandboxes).find(ws => ws.id === id);
    if (!workspace) {
      throw new Error(`workspace "${id}" not found. Use "workspace list" to see available workspaces.`);
    }
    if (workspace.sourcePath) {
      try {
        const content = await readFile(join(workspace.sourcePath, '.kaiden', 'workspace.json'), 'utf-8');
        return JSON.parse(content) as AgentWorkspaceConfiguration;
      } catch (error: unknown) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          return {} as AgentWorkspaceConfiguration;
        }
        throw error;
      }
    } else {
      return {};
    }
  }

  async updateConfiguration(id: string, config: Partial<AgentWorkspaceConfiguration>): Promise<void> {
    const workspaces = await this.listOpenshellSandboxes();
    const workspace = workspaces.flatMap(gw => gw.sandboxes).find(ws => ws.id === id);
    if (!workspace) {
      throw new Error(`workspace "${id}" not found. Use "workspace list" to see available workspaces.`);
    }
    if (workspace.sourcePath) {
      await updateWorkspaceConfig(join(workspace.sourcePath, '.kaiden'), config);
      this.apiSender.send('agent-workspace-update');
    }
  }

  async updateSummary(id: string, update: Pick<AgentWorkspaceSummary, 'name'>): Promise<void> {
    const instancesPath = join(homedir(), '.kdn', 'instances.json');
    const raw = await readFile(instancesPath, 'utf-8');
    const instances: unknown[] = JSON.parse(raw) as unknown[];
    const entry = instances.find(
      (item): item is Record<string, unknown> =>
        typeof item === 'object' && item !== null && (item as Record<string, unknown>)['id'] === id,
    );
    if (!entry) {
      throw new Error(`workspace "${id}" not found in instances.json`);
    }
    if (update.name !== undefined) {
      entry['name'] = update.name;
    }
    await writeFile(instancesPath, JSON.stringify(instances, undefined, 4) + '\n', 'utf-8');
  }

  async listOpenshellSandboxes(): Promise<GatewaySandboxes[]> {
    const results = await this.openshellCli.listSandboxesPerGateway();
    for (const entry of results) {
      for (const sandbox of entry.sandboxes) {
        if (sandbox.labels) {
          sandbox.sourcePath = decodeWorkspaceLabels(sandbox.labels);
        }
      }
    }
    return results;
  }

  async deleteOpenshellSandbox(name: string): Promise<void> {
    const task = this.taskManager.createTask({ title: `Deleting workspace ${name}` });
    task.state = 'running';
    task.status = 'in-progress';
    try {
      await this.openshellCli.deleteSandbox(name);
      this.apiSender.send('agent-workspace-update');
      task.status = 'success';
    } catch (err: unknown) {
      const detail = err instanceof Error ? err.message : String(err);
      task.status = 'failure';
      task.error = `Failed to delete workspace: ${detail}`;
      throw new Error(detail);
    } finally {
      task.state = 'completed';
    }
  }

  shellInAgentWorkspace(
    name: string,
    onData: (data: string) => void,
    _onError: (error: string) => void,
    onEnd: () => void,
  ): {
    write: (param: string) => void;
    resize: (w: number, h: number) => void;
    ptyProcess: IPty;
  } {
    const ptyProcess = spawn(this.openshellCli.getCliPath(), ['sandbox', 'connect', name], {
      name: 'xterm-256color',
      env: process.env as Record<string, string>,
    });

    ptyProcess.onData((data: string) => {
      onData(data);
    });

    ptyProcess.onExit(() => {
      onEnd();
    });

    return {
      write: (param: string): void => {
        ptyProcess.write(param);
      },
      resize: (cols: number, rows: number): void => {
        ptyProcess.resize(cols, rows);
      },
      ptyProcess,
    };
  }

  init(): void {
    const runtimeConfiguration: IConfigurationNode = {
      id: `preferences.${AgentWorkspaceSettings.SectionName}`,
      title: 'Agent Workspace',
      type: 'object',
      properties: {
        [`${AgentWorkspaceSettings.SectionName}.${AgentWorkspaceSettings.Runtime}`]: {
          description: 'Override the container runtime used when creating agent workspaces.',
          type: 'string',
          enum: ['podman', 'openshell'],
          default: 'podman',
        },
        [`${AgentWorkspaceSettings.SectionName}.${AgentWorkspaceSettings.DefaultBaseImage}`]: {
          description: 'Default base image for agent workspaces when the agent does not specify one.',
          type: 'string',
        },
      },
    };
    this.configurationRegistry.registerConfigurations([runtimeConfiguration]);

    this.ipcHandle(
      'agent-workspace:checkConfigExists',
      async (_listener: unknown, sourcePath: string): Promise<boolean> => {
        return this.checkWorkspaceConfigExists(sourcePath);
      },
    );

    this.ipcHandle(
      'agent-workspace:create',
      async (_listener: unknown, options: AgentWorkspaceCreateOptions): Promise<AgentWorkspaceId> => {
        return this.create(options);
      },
    );

    this.ipcHandle('agent-workspace:remove', async (_listener: unknown, id: string): Promise<AgentWorkspaceId> => {
      return this.remove(id);
    });

    this.ipcHandle(
      'agent-workspace:getConfiguration',
      async (_listener: unknown, id: string): Promise<AgentWorkspaceConfiguration> => {
        return this.getConfiguration(id);
      },
    );

    this.ipcHandle(
      'agent-workspace:updateConfiguration',
      async (_listener: unknown, id: string, config: Partial<AgentWorkspaceConfiguration>): Promise<void> => {
        return this.updateConfiguration(id, config);
      },
    );

    this.ipcHandle(
      'agent-workspace:updateSummary',
      async (_listener: unknown, id: string, update: Pick<AgentWorkspaceSummary, 'name'>): Promise<void> => {
        return this.updateSummary(id, update);
      },
    );

    this.ipcHandle('agent-workspace:listOpenshellSandboxes', async (): Promise<GatewaySandboxes[]> => {
      return this.listOpenshellSandboxes();
    });

    this.ipcHandle(
      'agent-workspace:deleteOpenshellSandbox',
      async (_listener: unknown, name: string): Promise<void> => {
        return this.deleteOpenshellSandbox(name);
      },
    );

    this.ipcHandle(
      'agent-workspace:terminal',
      async (_listener: unknown, id: string, onDataId: number): Promise<number> => {
        const workspaces = await this.listOpenshellSandboxes();
        const workspace = workspaces.flatMap(gw => gw.sandboxes).find(ws => ws.id === id);
        if (!workspace) {
          throw new Error(`workspace "${id}" not found. Use "workspace list" to see available workspaces.`);
        }

        const shouldExecuteCommand = !this.commandExecutedWorkspaces.has(id);
        let agentCommand: string | undefined;
        if (shouldExecuteCommand && workspace.labels) {
          const agentId = workspace.labels[AGENT_LABEL];
          if (agentId) {
            try {
              const agent = await this.agentRegistry.getAgent(agentId);
              agentCommand = agent?.command;
            } catch (err: unknown) {
              console.error(`Failed to resolve agent command for workspace "${id}":`, err);
            }
          }
        }

        if (agentCommand) {
          this.commandExecutedWorkspaces.add(id);
        }

        let commandSent = false;
        const invocation = this.shellInAgentWorkspace(
          workspace.name,
          (content: string) => {
            if (!this.webContents.isDestroyed()) {
              this.webContents.send('agent-workspace:terminal-onData', onDataId, content);
            }
            if (!commandSent && agentCommand) {
              commandSent = true;
              invocation.write(`${agentCommand}\n`);
            }
          },
          (error: string) => {
            if (!this.webContents.isDestroyed()) {
              this.webContents.send('agent-workspace:terminal-onError', onDataId, error);
            }
          },
          () => {
            if (!this.webContents.isDestroyed()) {
              this.webContents.send('agent-workspace:terminal-onEnd', onDataId);
            }
            this.terminalCallbacks.delete(onDataId);
            this.terminalProcesses.delete(onDataId);
          },
        );
        this.terminalCallbacks.set(onDataId, { write: invocation.write, resize: invocation.resize });
        this.terminalProcesses.set(onDataId, invocation.ptyProcess);
        return onDataId;
      },
    );

    this.ipcHandle(
      'agent-workspace:terminalSend',
      async (_listener: unknown, onDataId: number, content: string): Promise<void> => {
        const callback = this.terminalCallbacks.get(onDataId);
        if (callback) {
          callback.write(content);
        }
      },
    );

    this.ipcHandle(
      'agent-workspace:terminalResize',
      async (_listener: unknown, onDataId: number, width: number, height: number): Promise<void> => {
        const callback = this.terminalCallbacks.get(onDataId);
        if (callback) {
          callback.resize(width, height);
        }
      },
    );

    this.ipcHandle('agent-workspace:terminalClose', async (_listener: unknown, onDataId: number): Promise<void> => {
      const proc = this.terminalProcesses.get(onDataId);
      if (proc) {
        try {
          proc.kill();
        } catch {
          /* already exited */
        }
      }
      this.terminalProcesses.delete(onDataId);
      this.terminalCallbacks.delete(onDataId);
    });

    this.openshellGateway.onDidGatewayStart(() => {
      this.apiSender.send('agent-workspace-update');
    });

    this.watchInstancesFile();
  }

  private watchInstancesFile(): void {
    this.instancesWatcher?.dispose();
    const instancesPath = join(homedir(), '.kdn', 'instances.json');
    this.instancesWatcher = this.filesystemMonitoring.createFileSystemWatcher(instancesPath);
    const notify = (): void => {
      this.apiSender.send('agent-workspace-update');
    };
    this.instancesWatcher.onDidChange(notify);
    this.instancesWatcher.onDidCreate(notify);
    this.instancesWatcher.onDidDelete(notify);
  }

  @preDestroy()
  dispose(): void {
    this.instancesWatcher?.dispose();
    for (const proc of this.terminalProcesses.values()) {
      try {
        proc.kill();
      } catch {
        /* already exited */
      }
    }
    this.terminalProcesses.clear();
    this.terminalCallbacks.clear();
    this.commandExecutedWorkspaces.clear();
  }
}
