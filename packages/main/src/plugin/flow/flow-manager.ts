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
import { Disposable, Flow, FlowProviderConnection } from '@kortex-app/api';
import { inject, injectable, preDestroy } from 'inversify';

import { ApiSenderType } from '/@/plugin/api.js';
import { ProviderRegistry } from '/@/plugin/provider-registry.js';
import { FlowInfo } from '/@api/flow-info.js';

@injectable()
export class FlowManager implements Disposable {
  #workflows: Map<string, Array<Flow>> = new Map();
  #disposable: Map<string, Disposable> = new Map();

  constructor(
    @inject(ProviderRegistry)
    private provider: ProviderRegistry,
    @inject(ApiSenderType)
    private apiSender: ApiSenderType,
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
    return Array.from(this.#workflows.entries()).flatMap(([key, workflows]) => {
      const [providerId, connectionName ] = key.split(':'); // TODO: might do something better?

      // assert
      if(!providerId || !connectionName) return [];

      return workflows.map((workflow) => ({
        providerId,
        connectionName,
        ...workflow,
      }));
    });
  }

  public refresh(): void {
    this.registerAll().catch(console.error);
  }

  protected async registerAll(): Promise<void> {
    // Get all providers
    const providers = this.provider.getProviderInfos();

    // try to register all clients
    await Promise.allSettled(
      providers.flatMap(({ internalId }) => {
        const connections = this.provider.getFlowProviderConnection(internalId);
        return connections.map(this.register.bind(this, internalId));
      }),
    ).finally(() => {
      this.apiSender.send('flow:collected');
    });
  }

  /**
   * Register a new Workflow connection
   * @param providerId (not the internalId)
   * @param connection
   * @protected
   */
  protected async register(providerId: string, connection: FlowProviderConnection): Promise<void> {
    const key = this.getKey(providerId, connection.name);

    const workflows = await connection.flow.all();
    this.#workflows.set(key, workflows);

    // dispose of existing if any
    this.#disposable.get(key)?.dispose();

    // create disposable
    this.#disposable.set(key, connection.flow.onDidChange(() => {
      this.apiSender.send('flow:updated');
    }));
  }

  init(): void {
    // register listener for new Workflow connections
    this.provider.onDidRegisterFlowConnection(({ providerId, connection }) => {
      this.register(providerId, connection).catch(console.error); // do not block exec
    });

    // register listener for unregistered MCP connections
    this.provider.onDidUnregisterFlowConnection(({ providerId, connectionName }) => {
      const key = this.getKey(providerId, connectionName);

      this.#workflows.delete(key);
      this.#disposable.get(key)?.dispose();
      this.#disposable.delete(key);

      this.apiSender.send('flow:updated');
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
