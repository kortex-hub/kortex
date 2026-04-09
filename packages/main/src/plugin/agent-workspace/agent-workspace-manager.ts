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

import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';

import type { Disposable } from '@kortex-app/api';
import type { WebContents } from 'electron';
import { inject, injectable, preDestroy } from 'inversify';

import { IPCHandle, WebContentsType } from '/@/plugin/api.js';
import { Exec } from '/@/plugin/util/exec.js';
import type {
  AgentWorkspaceConfiguration,
  AgentWorkspaceId,
  AgentWorkspaceSummary,
} from '/@api/agent-workspace-info.js';
import { ApiSenderType } from '/@api/api-sender/api-sender-type.js';

/**
 * Manages agent workspaces by delegating to the `kdn` CLI.
 */
@injectable()
export class AgentWorkspaceManager implements Disposable {
  private readonly terminalCallbacks = new Map<
    number,
    { write: (param: string) => void; resize: (w: number, h: number) => void }
  >();
  private readonly terminalProcesses = new Map<number, ChildProcessWithoutNullStreams>();

  constructor(
    @inject(ApiSenderType)
    private readonly apiSender: ApiSenderType,
    @inject(IPCHandle)
    private readonly ipcHandle: IPCHandle,
    @inject(Exec)
    private readonly exec: Exec,
    @inject(WebContentsType)
    private readonly webContents: WebContents,
  ) {}

  private async execKdn<T>(args: string[]): Promise<T> {
    const result = await this.exec.exec('kdn', ['workspace', ...args, '--output', 'json']);
    return JSON.parse(result.stdout) as T;
  }

  async list(): Promise<AgentWorkspaceSummary[]> {
    const response = await this.execKdn<{ items: AgentWorkspaceSummary[] }>(['list']);
    return response.items;
  }

  async remove(id: string): Promise<AgentWorkspaceId> {
    const result = await this.execKdn<AgentWorkspaceId>(['remove', id]);
    this.apiSender.send('agent-workspace-update');
    return result;
  }

  async getConfiguration(id: string): Promise<AgentWorkspaceConfiguration> {
    const workspaces = await this.list();
    const workspace = workspaces.find(ws => ws.id === id);
    if (!workspace) {
      throw new Error(`workspace "${id}" not found. Use "workspace list" to see available workspaces.`);
    }
    try {
      const content = await readFile(workspace.paths.configuration, 'utf-8');
      return JSON.parse(content) as AgentWorkspaceConfiguration;
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return { name: workspace.name } as AgentWorkspaceConfiguration;
      }
      throw error;
    }
  }

  async start(id: string): Promise<AgentWorkspaceId> {
    const result = await this.execKdn<AgentWorkspaceId>(['start', id]);
    this.apiSender.send('agent-workspace-update');
    return result;
  }

  async stop(id: string): Promise<AgentWorkspaceId> {
    const result = await this.execKdn<AgentWorkspaceId>(['stop', id]);
    this.apiSender.send('agent-workspace-update');
    return result;
  }

  shellInAgentWorkspace(
    id: string,
    onData: (data: string) => void,
    onError: (error: string) => void,
    onEnd: () => void,
  ): {
    write: (param: string) => void;
    resize: (w: number, h: number) => void;
    process: ChildProcessWithoutNullStreams;
  } {
    // eslint-disable-next-line sonarjs/no-os-command-from-path
    const childProcess = spawn('kortex-cli', ['terminal', id]);

    childProcess.stdout.on('data', (chunk: Buffer) => {
      onData(chunk.toString('utf-8'));
    });

    childProcess.stderr.on('data', (chunk: Buffer) => {
      onData(chunk.toString('utf-8'));
    });

    childProcess.on('error', (error: Error) => {
      onError(error.message);
    });

    childProcess.on('close', () => {
      onEnd();
    });

    return {
      write: (param: string): void => {
        childProcess.stdin.write(param);
      },
      resize: (_w: number, _h: number): void => {
        // no-op: resize requires a PTY (e.g. node-pty); can be added later
      },
      process: childProcess,
    };
  }

  init(): void {
    this.ipcHandle('agent-workspace:list', async (): Promise<AgentWorkspaceSummary[]> => {
      return this.list();
    });

    this.ipcHandle('agent-workspace:remove', async (_listener: unknown, id: string): Promise<AgentWorkspaceId> => {
      return this.remove(id);
    });

    this.ipcHandle(
      'agent-workspace:getConfiguration',
      async (_listener: unknown, id: string): Promise<AgentWorkspaceConfiguration> => {
        return this.getConfiguration(id);
      },
    );

    this.ipcHandle('agent-workspace:start', async (_listener: unknown, id: string): Promise<AgentWorkspaceId> => {
      return this.start(id);
    });

    this.ipcHandle('agent-workspace:stop', async (_listener: unknown, id: string): Promise<AgentWorkspaceId> => {
      return this.stop(id);
    });

    this.ipcHandle(
      'agent-workspace:terminal',
      async (_listener: unknown, id: string, onDataId: number): Promise<number> => {
        const invocation = this.shellInAgentWorkspace(
          id,
          (content: string) => {
            this.webContents.send('agent-workspace:terminal-onData', onDataId, content);
          },
          (error: string) => {
            this.webContents.send('agent-workspace:terminal-onError', onDataId, error);
          },
          () => {
            this.webContents.send('agent-workspace:terminal-onEnd', onDataId);
            this.terminalCallbacks.delete(onDataId);
            this.terminalProcesses.delete(onDataId);
          },
        );
        this.terminalCallbacks.set(onDataId, { write: invocation.write, resize: invocation.resize });
        this.terminalProcesses.set(onDataId, invocation.process);
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
  }

  @preDestroy()
  dispose(): void {
    for (const proc of this.terminalProcesses.values()) {
      if (!proc.killed) {
        proc.kill();
      }
    }
    this.terminalProcesses.clear();
    this.terminalCallbacks.clear();
  }
}
