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

import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { promisify } from 'node:util';

import { inject, injectable, preDestroy } from 'inversify';

import { IPCHandle } from '/@/plugin/api.js';
import { Directories } from '/@/plugin/directories.js';
import { MCPManager } from '/@/plugin/mcp/mcp-manager.js';
import { RagEnvironmentRegistry } from '/@/plugin/rag-environment-registry.js';
import { SecretManager } from '/@/plugin/secret-manager/secret-manager.js';
import { SkillManager } from '/@/plugin/skill/skill-manager.js';
import { TaskManager } from '/@/plugin/tasks/task-manager.js';
import { resolveHomePath } from '/@/plugin/util/resolve-home-path.js';
import { ApiSenderType } from '/@api/api-sender/api-sender-type.js';
import type { IDisposable } from '/@api/disposable.js';
import type {
  WorkspaceProjectAnalysis,
  WorkspaceProjectCreateOptions,
  WorkspaceProjectInfo,
  WorkspaceProjectUpdateOptions,
} from '/@api/workspace-project-info.js';

const execFileAsync = promisify(execFile);

@injectable()
export class WorkspaceProjectManager {
  private projects: Map<string, WorkspaceProjectInfo> = new Map();
  private disposables: IDisposable[] = [];

  constructor(
    @inject(ApiSenderType) private readonly apiSender: ApiSenderType,
    @inject(IPCHandle) private readonly ipcHandle: IPCHandle,
    @inject(Directories) private readonly directories: Directories,
    @inject(SkillManager) private readonly skillManager: SkillManager,
    @inject(MCPManager) private readonly mcpManager: MCPManager,
    @inject(SecretManager) private readonly secretManager: SecretManager,
    @inject(RagEnvironmentRegistry) private readonly ragEnvironmentRegistry: RagEnvironmentRegistry,
    @inject(TaskManager) private readonly taskManager: TaskManager,
  ) {}

  async init(): Promise<void> {
    const dir = this.directories.getWorkspaceProjectsDirectory();
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }

    await this.loadFromDisk();

    this.ipcHandle('workspace-project-manager:list', async (): Promise<WorkspaceProjectInfo[]> => {
      return this.list();
    });

    this.ipcHandle(
      'workspace-project-manager:get',
      async (_listener: unknown, id: string): Promise<WorkspaceProjectInfo> => {
        return this.get(id);
      },
    );

    this.ipcHandle(
      'workspace-project-manager:create',
      async (_listener: unknown, options: WorkspaceProjectCreateOptions): Promise<WorkspaceProjectInfo> => {
        return this.create(options);
      },
    );

    this.ipcHandle('workspace-project-manager:remove', async (_listener: unknown, id: string): Promise<void> => {
      return this.remove(id);
    });

    this.ipcHandle(
      'workspace-project-manager:update',
      async (_listener: unknown, id: string, options: WorkspaceProjectUpdateOptions): Promise<WorkspaceProjectInfo> => {
        return this.update(id, options);
      },
    );

    this.ipcHandle(
      'workspace-project-manager:analyze',
      async (_listener: unknown, folderPath: string): Promise<WorkspaceProjectAnalysis> => {
        return this.analyze(folderPath);
      },
    );

    this.ipcHandle(
      'workspace-project-manager:clone-and-analyze',
      async (_listener: unknown, gitUrl: string, targetPath: string): Promise<WorkspaceProjectAnalysis> => {
        return this.cloneAndAnalyze(gitUrl, targetPath);
      },
    );

    const onExternalUpdate = (): void => {
      this.sanitizeAllCached().catch(console.error);
    };
    this.disposables.push(this.apiSender.receive('skill-manager-update', onExternalUpdate));
    this.disposables.push(this.apiSender.receive('mcp-manager-update', onExternalUpdate));
    this.disposables.push(this.apiSender.receive('secret-manager-update', onExternalUpdate));
    this.disposables.push(this.apiSender.receive('rag-environment-created', onExternalUpdate));
    this.disposables.push(this.apiSender.receive('rag-environment-updated', onExternalUpdate));
    this.disposables.push(this.apiSender.receive('rag-environment-deleted', onExternalUpdate));
  }

  list(): WorkspaceProjectInfo[] {
    return Array.from(this.projects.values());
  }

  get(id: string): WorkspaceProjectInfo {
    const project = this.projects.get(id);
    if (!project) {
      throw new Error(`Workspace project "${id}" not found`);
    }
    return project;
  }

  async create(options: WorkspaceProjectCreateOptions): Promise<WorkspaceProjectInfo> {
    await this.validateReferences(options);

    const id = this.getSafeId(options.name);
    const project: WorkspaceProjectInfo = { ...options, id };
    if (this.projects.has(project.id)) {
      throw new Error(`Workspace project "${project.id}" already exists`);
    }
    await this.saveToDisk(project);
    this.projects.set(project.id, project);
    this.apiSender.send('workspace-project-update');
    return project;
  }

  async remove(id: string): Promise<void> {
    if (!this.projects.has(id)) {
      throw new Error(`Workspace project "${id}" not found`);
    }
    await rm(this.getFilePath(id));
    this.projects.delete(id);
    this.apiSender.send('workspace-project-update');
  }

  async update(id: string, options: WorkspaceProjectUpdateOptions): Promise<WorkspaceProjectInfo> {
    const existing = this.get(id);
    const updated: WorkspaceProjectInfo = { ...existing, ...options, id };
    await this.validateReferences(updated);
    await this.saveToDisk(updated);
    this.projects.set(id, updated);
    this.apiSender.send('workspace-project-update');
    return updated;
  }

  async analyze(folderPath: string): Promise<WorkspaceProjectAnalysis> {
    const resolvedPath = resolveHomePath(folderPath);

    if (!existsSync(resolvedPath)) {
      throw new Error(`Path "${resolvedPath}" does not exist`);
    }

    const name = basename(resolvedPath) || resolvedPath;
    const gitInfo = await this.detectGitInfo(resolvedPath);

    return {
      name: name.charAt(0).toUpperCase() + name.slice(1),
      description: 'Auto-detected project from local working directory.',
      folder: resolvedPath,
      gitRepository: gitInfo?.remote,
      gitBranch: gitInfo?.branch,
    };
  }

  async cloneAndAnalyze(gitUrl: string, targetPath: string): Promise<WorkspaceProjectAnalysis> {
    const resolvedPath = resolveHomePath(targetPath);

    if (existsSync(resolvedPath)) {
      throw new Error(`Target path "${resolvedPath}" already exists`);
    }

    const parentDir = join(resolvedPath, '..');
    if (!existsSync(parentDir)) {
      throw new Error(`Parent directory "${parentDir}" does not exist`);
    }

    const task = this.taskManager.createTask({ title: 'Cloning repository' });

    try {
      await execFileAsync('git', ['clone', gitUrl, resolvedPath]);
      task.status = 'success';
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('Authentication') || message.includes('could not read Username')) {
        task.error = 'Authentication failed';
        task.status = 'failure';
        throw new Error('Authentication failed. Make sure you can clone this repository from your terminal.');
      }
      task.error = `Failed to clone repository: ${message}`;
      task.status = 'failure';
      throw new Error(`Failed to clone repository: ${message}`);
    } finally {
      task.state = 'completed';
    }

    return this.analyze(resolvedPath);
  }

  private async detectGitInfo(folderPath: string): Promise<{ remote?: string; branch?: string } | undefined> {
    if (!existsSync(join(folderPath, '.git'))) {
      return undefined;
    }

    try {
      const [remoteUrl, branchResult] = await Promise.all([
        this.getGitRemoteUrl(folderPath),
        execFileAsync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: folderPath }).catch(() => undefined),
      ]);

      const branch = branchResult?.stdout.trim();

      return { remote: remoteUrl ?? undefined, branch: branch ?? undefined };
    } catch {
      return undefined;
    }
  }

  private async getGitRemoteUrl(folderPath: string): Promise<string | undefined> {
    const originResult = await execFileAsync('git', ['remote', 'get-url', 'origin'], { cwd: folderPath }).catch(
      () => undefined,
    );
    if (originResult?.stdout.trim()) {
      return originResult.stdout.trim();
    }

    const remotesResult = await execFileAsync('git', ['remote'], { cwd: folderPath }).catch(() => undefined);
    const firstRemote = remotesResult?.stdout.trim().split(/\r?\n/)[0];
    if (!firstRemote) {
      return undefined;
    }

    const result = await execFileAsync('git', ['remote', 'get-url', firstRemote], { cwd: folderPath }).catch(
      () => undefined,
    );
    return result?.stdout.trim() ?? undefined;
  }

  private async validateReferences(options: WorkspaceProjectCreateOptions | WorkspaceProjectInfo): Promise<void> {
    const errors: string[] = [];

    if (options.skills.length > 0) {
      const knownSkills = new Set(this.skillManager.listSkills().map(s => s.name));
      const invalid = options.skills.filter(name => !knownSkills.has(name));
      if (invalid.length > 0) {
        errors.push(`Unknown skills: ${invalid.join(', ')}`);
      }
    }

    if (options.mcpServers.length > 0) {
      const knownServers = new Set((await this.mcpManager.listMCPRemoteServers()).map(s => s.id));
      const invalid = options.mcpServers.filter(id => !knownServers.has(id));
      if (invalid.length > 0) {
        errors.push(`Unknown MCP servers: ${invalid.join(', ')}`);
      }
    }

    if (options.secrets.length > 0) {
      const knownSecrets = new Set((await this.secretManager.list()).map(s => s.name));
      const invalid = options.secrets.filter(name => !knownSecrets.has(name));
      if (invalid.length > 0) {
        errors.push(`Unknown secrets: ${invalid.join(', ')}`);
      }
    }

    if (options.knowledges.length > 0) {
      const knownKnowledges = new Set((await this.ragEnvironmentRegistry.getAllRagEnvironments()).map(e => e.name));
      const invalid = options.knowledges.filter(name => !knownKnowledges.has(name));
      if (invalid.length > 0) {
        errors.push(`Unknown knowledges: ${invalid.join(', ')}`);
      }
    }

    if (errors.length > 0) {
      throw new Error(errors.join('; '));
    }
  }

  private async loadFromDisk(): Promise<void> {
    const dir = this.directories.getWorkspaceProjectsDirectory();
    if (!existsSync(dir)) {
      return;
    }
    const entries = await readdir(dir);
    for (const entry of entries) {
      if (!entry.endsWith('.json')) {
        continue;
      }
      try {
        const raw = await readFile(join(dir, entry), 'utf-8');
        const project = JSON.parse(raw) as WorkspaceProjectInfo;
        const sanitized = await this.sanitizeReferences(project);
        this.projects.set(sanitized.id, sanitized);
        if (sanitized !== project) {
          await this.saveToDisk(sanitized);
        }
      } catch (e: unknown) {
        console.error(`Failed to load workspace project file "${entry}"`, e);
      }
    }
  }

  private async sanitizeReferences(project: WorkspaceProjectInfo): Promise<WorkspaceProjectInfo> {
    const knownSkills = new Set(this.skillManager.listSkills().map(s => s.name));
    const knownServers = new Set((await this.mcpManager.listMCPRemoteServers()).map(s => s.id));
    const knownSecrets = new Set((await this.secretManager.list()).map(s => s.name));
    const knownKnowledges = new Set((await this.ragEnvironmentRegistry.getAllRagEnvironments()).map(e => e.name));

    const skills = project.skills.filter(name => knownSkills.has(name));
    const mcpServers = project.mcpServers.filter(name => knownServers.has(name));
    const secrets = project.secrets.filter(name => knownSecrets.has(name));
    const knowledges = project.knowledges.filter(name => knownKnowledges.has(name));

    if (
      skills.length === project.skills.length &&
      mcpServers.length === project.mcpServers.length &&
      secrets.length === project.secrets.length &&
      knowledges.length === project.knowledges.length
    ) {
      return project;
    }
    return { ...project, skills, mcpServers, secrets, knowledges };
  }

  private async sanitizeAllCached(): Promise<void> {
    let changed = false;
    for (const [id, project] of this.projects) {
      const sanitized = await this.sanitizeReferences(project);
      if (sanitized !== project) {
        this.projects.set(id, sanitized);
        await this.saveToDisk(sanitized);
        changed = true;
      }
    }
    if (changed) {
      this.apiSender.send('workspace-project-update');
    }
  }

  private async saveToDisk(project: WorkspaceProjectInfo): Promise<void> {
    await writeFile(this.getFilePath(project.id), JSON.stringify(project, undefined, 2) + '\n', 'utf-8');
  }

  private getSafeId(input: string): string {
    const normalized = input.trim().replace(/[\\/]/g, '-');
    if (!normalized || normalized === '.' || normalized === '..' || basename(normalized) !== normalized) {
      throw new Error('Invalid workspace project id');
    }
    return normalized;
  }

  private getFilePath(id: string): string {
    const safeId = this.getSafeId(id);
    return join(this.directories.getWorkspaceProjectsDirectory(), `${safeId}.json`);
  }

  @preDestroy()
  dispose(): void {
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
  }
}
