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
  #installedProviders: Set<string> = new Set();
  #flows: Map<string, Array<Flow>> = new Map();
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

  hasInstalledFlowProviders(): boolean {
    return Array.from(this.#installedProviders).length > 0;
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
   * Register a new Flow connection
   * @param providerId (not the internalId)
   * @param connection
   * @protected
   */
  protected async register(providerId: string, connection: FlowProviderConnection): Promise<void> {
    const key = this.getKey(providerId, connection.name);

    const flows = await connection.flow.all();
    this.#flows.set(key, flows);

    if (connection.flow.installed) {
      this.#installedProviders.add(key);
    }

    // dispose of existing if any
    this.#disposable.get(key)?.dispose();

    // create disposable
    this.#disposable.set(
      key,
      connection.flow.onDidChange(() => {
        this.apiSender.send('flow:updated');
      }),
    );
  }

  init(): void {
    // register listener for new Flow connections
    this.provider.onDidRegisterFlowConnection(({ providerId, connection }) => {
      this.register(providerId, connection).catch(console.error); // do not block exec
    });

    // register listener for unregistered MCP connections
    this.provider.onDidUnregisterFlowConnection(({ providerId, connectionName }) => {
      const key = this.getKey(providerId, connectionName);

      this.#flows.delete(key);
      this.#disposable.get(key)?.dispose();
      this.#disposable.delete(key);
      this.#installedProviders.delete(key);

      this.apiSender.send('flow:updated');
    });

    // register all connections
    this.registerAll().catch(console.error);
  }

  @preDestroy()
  dispose(): void {
    this.#flows.clear();
    this.#disposable.values().forEach(d => d.dispose());
    this.#installedProviders.clear();
  }
}
