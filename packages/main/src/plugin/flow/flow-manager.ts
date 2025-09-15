/**********************************************************************
 * Copyright (C) 2025 Red Hat, Inc.
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
import type { Disposable, Flow, FlowProviderConnection, Logger } from '@kortex-app/api';
import { inject, injectable, preDestroy } from 'inversify';

import { ApiSenderType } from '/@/plugin/api.js';
import { ProviderRegistry } from '/@/plugin/provider-registry.js';
import type { FlowExecuteInfo } from '/@api/flow-execute-info.js';
import type { FlowInfo } from '/@api/flow-info.js';

import { TaskManager } from '../tasks/task-manager.js';

class BufferLogger implements Logger {
  #buffer = '';

  constructor(private apiSender: ApiSenderType) {}

  getBuffer(): string {
    return this.#buffer;
  }

  log(message: string): void {
    this.#buffer += message;
    this.apiSender.send('flow:current-log');
  }
  error(message: string): void {
    this.#buffer += message;
    this.apiSender.send('flow:current-log');
  }
  warn(message: string): void {
    this.#buffer += message;
    this.apiSender.send('flow:current-log');
  }
}

@injectable()
export class FlowManager implements Disposable {
  #flows: Map<string, Array<Flow>> = new Map();
  // key = execution id = task id
  #flowsExecution: Map<string, FlowExecuteInfo> = new Map();
  #flowsLogs: Map<string, BufferLogger> = new Map();
  #disposable: Map<string, Disposable> = new Map();
  #currentLogger: BufferLogger | undefined = undefined;

  constructor(
    @inject(ProviderRegistry)
    private provider: ProviderRegistry,
    @inject(ApiSenderType)
    private apiSender: ApiSenderType,
    @inject(TaskManager)
    private taskManager: TaskManager,
  ) {}

  /**
   *
   * @param providerId (not the internalId)
   * @param connectionName
   * @protected
   */
  protected getKey(providerId: string, connectionName: string): string {
    return `${providerId}:${connectionName}`;
  }

  all(): Array<FlowInfo> {
    return Array.from(this.#flows.entries()).flatMap(([key, flows]) => {
      const [providerId, connectionName] = key.split(':'); // TODO: might do something better?

      // assert
      if (!providerId || !connectionName) return [];

      return flows.map(flow => ({
        providerId,
        connectionName,
        ...flow,
      }));
    });
  }

  public async execute(providerId: string, connectionName: string, flowId: string): Promise<string> {
    // Get the flow provider to use
    const flowProvider = this.provider.getProvider(providerId);
    const flowConnection = flowProvider.flowConnections.find(({ name }) => name === connectionName);
    if (!flowConnection) throw new Error(`cannot find flow connection with name ${connectionName}`);

    const task = this.taskManager.createTask({ title: `Execute flow ${flowId}` });
    const logger = new BufferLogger(this.apiSender);
    this.#flowsLogs.set(task.id, logger);

    const flowInfo: FlowInfo = {
      connectionName,
      providerId,
      id: flowId,
      path: '',
    };
    const flowExecuteInfo: FlowExecuteInfo = {
      taskId: task.id,
      flowInfo,
    };

    this.#flowsExecution.set(task.id, flowExecuteInfo);
    // notify start
    this.apiSender.send('flow:execute');

    task.state = 'running';
    task.status = 'in-progress';

    flowConnection.flow
      .execute(flowId, logger)
      .then(() => {
        task.state = 'completed';
        task.status = 'success';
      })
      .catch((error: unknown) => {
        task.status = 'failure';
        task.error = String(error);
        task.state = 'completed';
      })
      .finally(() => {
        // notify sucess/error
        this.apiSender.send('flow:execute');
        this.apiSender.send('flow:current-log');
      });

    return task.id;
  }

  public async dispatchLog(
    _providerId: string,
    _connectionName: string,
    _flowId: string,
    taskId: string,
  ): Promise<void> {
    this.#currentLogger = this.#flowsLogs.get(taskId);
    this.apiSender.send('flow:current-log');
  }

  public async listExecutions(): Promise<FlowExecuteInfo[]> {
    return Array.from(this.#flowsExecution.values());
  }

  public refresh(): void {
    this.#flows.clear();
    this.registerAll().catch(console.error);
  }

  protected async registerAll(): Promise<void> {
    // Get all providers
    const providers = this.provider.getProviderInfos();

    // try to register all clients
    await Promise.allSettled(
      providers.flatMap(({ id, internalId }) => {
        const connections = this.provider.getFlowProviderConnection(internalId);
        return connections.map(this.register.bind(this, id));
      }),
    ).finally(() => {
      this.apiSender.send('flow:updated');
    });
  }

  /**
   * Register a new Flow connection
   * @param providerId (not the internalId)
   * @param connection
   * @protected
   */
  protected async register(providerId: string, connection: FlowProviderConnection): Promise<void> {
    const key = this.getKey(providerId, connection.name);

    const flows = await connection.flow.all();
    this.#flows.set(key, flows);

    // dispose of existing if any
    this.#disposable.get(key)?.dispose();

    // create disposable
    this.#disposable.set(
      key,
      connection.flow.onDidChange(() => {
        this.refresh();
      }),
    );
  }

  init(): void {
    // register listener for new Flow connections
    this.provider.onDidRegisterFlowConnection(({ providerId, connection }) => {
      this.register(providerId, connection)
        .then(() => {
          this.apiSender.send('flow:updated');
        })
        .catch(console.error); // do not block exec
    });

    // register listener for unregistered MCP connections
    this.provider.onDidUnregisterFlowConnection(({ providerId, connectionName }) => {
      const key = this.getKey(providerId, connectionName);

      this.#flows.delete(key);
      this.#disposable.get(key)?.dispose();
      this.#disposable.delete(key);

      this.apiSender.send('flow:updated');
    });

    // register all connections
    this.registerAll().catch(console.error);
  }

  async getLogCurrent(): Promise<string> {
    return this.#currentLogger?.getBuffer() ?? '';
  }

  @preDestroy()
  dispose(): void {
    this.#flows.clear();
    this.#disposable.values().forEach(d => d.dispose());
  }
}
