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
import { Disposable, Workflow, WorkflowProviderConnection } from '@kortex-app/api';
import { inject, injectable, preDestroy } from 'inversify';

import { ApiSenderType } from '/@/plugin/api.js';
import { ProviderRegistry } from '/@/plugin/provider-registry.js';
import { WorkflowInfo } from '/@api/workflow-info.js';

@injectable()
export class WorkflowManager implements Disposable {
  #workflows: Map<string, Array<Workflow>> = new Map();
  #disposable: Map<string, Disposable> = new Map();

  constructor(
    @inject(ProviderRegistry)
    private provider: ProviderRegistry,
    @inject(ApiSenderType)
    private apiSender: ApiSenderType,
  ) {}

  protected getKey(internalProviderId: string, connectionName: string): string {
    return `${internalProviderId}:${connectionName}`;
  }

  all(): Array<WorkflowInfo> {
    return Array.from(this.#workflows.entries()).flatMap(([key, workflows]) => {
      const [internalProviderId, connectionName ] = key.split(':'); // TODO: might do something better?

      // assert
      if(!internalProviderId || !connectionName) return [];

      return workflows.map((workflow) => ({
        internalProviderId,
        connectionName,
        ...workflow,
      }));
    });
  }

  public getWorkflow(internalProviderId: string, connectionName: string, workflowId: string): Workflow {
    const key = this.getKey(internalProviderId, connectionName);
    const workflows = this.#workflows.get(key);
    if (!workflows) {
      throw new Error(`No workflows found for ${key}`);
    }
    const workflow = workflows.find(({ path }) => path === workflowId);
    if(!workflow) {
      throw new Error(`No workflow found for ${key} with id ${workflowId}`);
    }
    return workflow;
  }

  public refresh(): void {
    console.log('refreshing workflows');
    this.registerAll().catch(console.error);
  }

  protected async registerAll(): Promise<void> {
    // Get all providers
    const providers = this.provider.getProviderInfos();

    // try to register all clients
    await Promise.allSettled(
      providers.flatMap(({ internalId }) => {
        const connections = this.provider.getWorkflowProviderConnection(internalId);
        return connections.map(this.register.bind(this, internalId));
      }),
    ).finally(() => {
      this.apiSender.send('workflow:collected');
    });
  }

  /**
   * Register a new Workflow connection
   * @param internalProviderId
   * @param connection
   * @protected
   */
  protected async register(internalProviderId: string, connection: WorkflowProviderConnection): Promise<void> {
    const key = this.getKey(internalProviderId, connection.name);

    const workflows = await connection.workflow.all();
    console.log(`found ${workflows.length} for ${key}`);
    this.#workflows.set(key, workflows);

    // dispose of existing if any
    this.#disposable.get(key)?.dispose();

    // create disposable
    this.#disposable.set(key, connection.workflow.onDidChange(() => {
      this.apiSender.send('workflow:updated');
    }));
  }

  init(): void {
    // register listener for new Workflow connections
    this.provider.onDidRegisterWorkflowConnection(({ providerId, connection }) => {
      const internalProviderId = this.provider.getMatchingProviderInternalId(providerId);
      this.register(internalProviderId, connection).catch(console.error); // do not block exec
    });

    // register listener for unregistered MCP connections
    this.provider.onDidUnregisterWorkflowConnection(({ providerId, connectionName }) => {
      const internalProviderId = this.provider.getMatchingProviderInternalId(providerId);
      const key = this.getKey(internalProviderId, connectionName);

      this.#workflows.delete(key);
      this.apiSender.send('workflow:updated');
    });

    // register all connections
    this.registerAll().catch(console.error);
  }

  @preDestroy()
  dispose(): void {
    this.#workflows.clear();
    this.#disposable.values().forEach((d) => d.dispose());
  }

}
