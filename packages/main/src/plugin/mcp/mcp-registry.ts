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

import * as crypto from 'node:crypto';

import type * as kortexAPI from '@kortex-app/api';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { HttpsOptions, OptionsOfTextResponseBody } from 'got';
import { HttpProxyAgent, HttpsProxyAgent } from 'hpagent';
import { inject, injectable } from 'inversify';

import type { MCPRegistryServerDetail, MCPRegistryServerList } from '/@api/mcp/mcp-registry-server-entry.js';

import { ApiSenderType } from '../api.js';
import { Certificates } from '../certificates.js';
import { Emitter } from '../events/emitter.js';
import { Proxy } from '../proxy.js';
import { Telemetry } from '../telemetry/telemetry.js';
import { Disposable } from '../types/disposable.js';
import { MCPManager } from './mcp-manager.js';

export interface RegistryAuthInfo {
  authUrl: string;
  service?: string;
  scope?: string;
  scheme: string;
}

// Definition of all MCP registries (MCP registry is an URL serving MCP providers it implements the MCP registry protocol)
@injectable()
export class MCPRegistry {
  private registries: kortexAPI.MCPRegistry[] = [];
  private suggestedRegistries: kortexAPI.RegistrySuggestedProvider[] = [];
  private providers: Map<string, kortexAPI.MCPRegistryProvider> = new Map();

  private readonly _onDidRegisterRegistry = new Emitter<kortexAPI.MCPRegistry>();
  private readonly _onDidUpdateRegistry = new Emitter<kortexAPI.MCPRegistry>();
  private readonly _onDidUnregisterRegistry = new Emitter<kortexAPI.MCPRegistry>();

  readonly onDidRegisterRegistry: kortexAPI.Event<kortexAPI.MCPRegistry> = this._onDidRegisterRegistry.event;
  readonly onDidUpdateRegistry: kortexAPI.Event<kortexAPI.MCPRegistry> = this._onDidUpdateRegistry.event;
  readonly onDidUnregisterRegistry: kortexAPI.Event<kortexAPI.MCPRegistry> = this._onDidUnregisterRegistry.event;

  private proxySettings: kortexAPI.ProxySettings | undefined;
  private proxyEnabled: boolean;

  constructor(
    @inject(ApiSenderType)
    private apiSender: ApiSenderType,
    @inject(Telemetry)
    private telemetryService: Telemetry,
    @inject(Certificates)
    private certificates: Certificates,
    @inject(Proxy)
    private proxy: Proxy,
    @inject(MCPManager)
    private mcpManager: MCPManager,
  ) {
    this.proxy.onDidUpdateProxy(settings => {
      this.proxySettings = settings;
    });

    this.proxy.onDidStateChange(state => {
      this.proxyEnabled = state;
    });

    this.proxyEnabled = this.proxy.isEnabled();
    if (this.proxyEnabled) {
      this.proxySettings = this.proxy.proxy;
    }
  }

  getRegistryHash(registry: { serverUrl: string }): string {
    return crypto.createHash('sha512').update(registry.serverUrl).digest('hex');
  }

  registerMCPRegistry(registry: kortexAPI.MCPRegistry): Disposable {
    const found = this.registries.find(reg => reg.serverUrl === registry.serverUrl);
    if (found) {
      // Ignore and don't register - extension may register registries every time it is restarted
      console.log('Registry already registered, skipping registration');
      return Disposable.noop();
    }
    this.registries = [...this.registries, registry];
    this.telemetryService.track('registerRegistry', {
      serverUrl: this.getRegistryHash(registry),
      total: this.registries.length,
    });
    this.apiSender.send('mcp-registry-register', registry);
    this._onDidRegisterRegistry.fire(Object.freeze({ ...registry }));
    return Disposable.create(() => {
      this.unregisterMCPRegistry(registry);
    });
  }

  suggestMCPRegistry(registry: kortexAPI.MCPRegistrySuggestedProvider): Disposable {
    // Do not add it to the list if it's already been suggested by name & URL
    // this may have been done by another extension.
    if (this.suggestedRegistries.find(reg => reg.url === registry.url && reg.name === registry.name)) {
      // Ignore and don't register
      console.log(`Registry already registered: ${registry.url}`);
      return Disposable.noop();
    }

    this.suggestedRegistries.push(registry);
    this.apiSender.send('mcp-registry-update', registry);

    // Create a disposable to remove the registry from the list
    return Disposable.create(() => {
      this.unsuggestMCPRegistry(registry);
    });
  }

  unsuggestMCPRegistry(registry: kortexAPI.MCPRegistrySuggestedProvider): void {
    // Find the registry within this.suggestedRegistries[] and remove it
    const index = this.suggestedRegistries.findIndex(reg => reg.url === registry.url && reg.name === registry.name);
    if (index > -1) {
      this.suggestedRegistries.splice(index, 1);
    }

    // Fire an update to the UI to remove the suggested registry
    this.apiSender.send('mcp-registry-update', registry);
  }

  unregisterMCPRegistry(registry: kortexAPI.MCPRegistry): void {
    const filtered = this.registries.filter(registryItem => registryItem.serverUrl !== registry.serverUrl);
    if (filtered.length !== this.registries.length) {
      this._onDidUnregisterRegistry.fire(Object.freeze({ ...registry }));
      this.registries = filtered;
      this.apiSender.send('mcp-registry-unregister', registry);
    }
    this.telemetryService.track('unregisterMCPRegistry', {
      serverUrl: this.getRegistryHash(registry),
      total: this.registries.length,
    });
  }

  getRegistries(): readonly kortexAPI.MCPRegistry[] {
    return this.registries;
  }

  getSuggestedRegistries(): kortexAPI.MCPRegistrySuggestedProvider[] {
    return this.suggestedRegistries;
  }

  getProviderNames(): string[] {
    return Array.from(this.providers.keys());
  }

  registerMCPRegistryProvider(registerRegistryProvider: kortexAPI.MCPRegistryProvider): Disposable {
    this.providers.set(registerRegistryProvider.name, registerRegistryProvider);
    return Disposable.create(() => {
      this.providers.delete(registerRegistryProvider.name);
    });
  }

  async createRegistry(registryCreateOptions: kortexAPI.MCPRegistryCreateOptions): Promise<Disposable> {
    let telemetryOptions = {};
    try {
      const exists = this.registries.find(registry => registry.serverUrl === registryCreateOptions.serverUrl);
      if (exists) {
        throw new Error(`Registry ${registryCreateOptions.serverUrl} already exists`);
      }

      return this.registerMCPRegistry(registryCreateOptions);
    } catch (error) {
      telemetryOptions = { error: error };
      throw error;
    } finally {
      this.telemetryService.track('createMCPRegistry', {
        serverUrlHash: this.getRegistryHash(registryCreateOptions),
        total: this.registries.length,
        ...telemetryOptions,
      });
    }
  }

  async createMCPServerFromRemoteRegistry(
    serverId: string,
    remoteId: number,
    headersParams: { name: string; value: string }[],
  ): Promise<void> {
    // create the mcp connection
    const headers: { [key: string]: string } = {};
    for (const header of headersParams) {
      let keyValue = header.value;
      let keyName = header.name;
      if (header.name === 'Bearer') {
        keyName = 'Authorization';
        keyValue = `Bearer ${keyValue}`;
      }
      headers[keyName] = keyValue;
    }

    // get the remote from the server-id/remoteId

    const serverDetails = await this.listMCPServersFromRegistries();
    const serverDetail = serverDetails.find(server => server.id === serverId);
    if (!serverDetail) {
      throw new Error(`MCP server with id ${serverId} not found in remote registry`);
    }
    // remotes ?
    const hasRemote = serverDetail.remotes && serverDetail.remotes.length >= remoteId;
    if (!hasRemote) {
      throw new Error(`MCP server with id ${serverId} does not have remote with id ${remoteId}`);
    }
    const remote = serverDetail?.remotes?.[remoteId];
    if (!remote) {
      throw new Error(`MCP server with id ${serverId} does not have remote with id ${remoteId}`);
    }

    const name = serverDetail.name;

    // create transport
    const transport = new StreamableHTTPClientTransport(new URL(remote.url), {
      requestInit: {
        headers,
      },
    });

    await this.mcpManager.registerMCPClient('internal', name, transport, remote.url);
  }

  async listMCPServersFromRegistries(): Promise<MCPRegistryServerDetail[]> {
    // connect to each registry and grab server details
    const serverDetails: MCPRegistryServerDetail[] = [];

    // merge all urls to inspect
    const serverUrls: string[] = this.registries
      .map(registry => registry.serverUrl)
      .concat(this.suggestedRegistries.map(registry => registry.url));

    for (const registryURL of serverUrls) {
      // connect to ${registry.serverUrl}/v0/servers and grab the list of servers
      // use fetch

      const content = await fetch(`${registryURL}/v0/servers`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (!content.ok) {
        console.error(`Failed to fetch MCP servers from ${registryURL}: ${content.statusText}`);
      }
      const serverList: MCPRegistryServerList = await content.json();

      // now, aggregate the servers from the list
      serverDetails.push(...serverList.servers);
    }
    return serverDetails;
  }

  async updateMCPRegistry(registry: kortexAPI.MCPRegistry): Promise<void> {
    const matchingRegistry = this.registries.find(
      existingRegistry => registry.serverUrl === existingRegistry.serverUrl,
    );
    if (!matchingRegistry) {
      throw new Error(`MCP Registry ${registry.serverUrl} was not found`);
    }
    this.telemetryService.track('updateMCPRegistry', {
      serverUrl: this.getRegistryHash(matchingRegistry),
      total: this.registries.length,
    });
    this.apiSender.send('mcp-registry-update', registry);
    this._onDidUpdateRegistry.fire(Object.freeze(registry));
  }

  getOptions(insecure?: boolean): OptionsOfTextResponseBody {
    const httpsOptions: HttpsOptions = {};
    const options: OptionsOfTextResponseBody = {
      https: httpsOptions,
    };

    if (options.https) {
      options.https.certificateAuthority = this.certificates.getAllCertificates();
      if (insecure) {
        options.https.rejectUnauthorized = false;
      }
    }

    if (this.proxyEnabled) {
      // use proxy when performing got request
      const proxy = this.proxySettings;
      const httpProxyUrl = proxy?.httpProxy;
      const httpsProxyUrl = proxy?.httpsProxy;

      if (httpProxyUrl) {
        options.agent ??= {};
        try {
          options.agent.http = new HttpProxyAgent({
            keepAlive: true,
            keepAliveMsecs: 1000,
            maxSockets: 256,
            maxFreeSockets: 256,
            scheduling: 'lifo',
            proxy: httpProxyUrl,
          });
        } catch (error) {
          throw new Error(`Failed to create http proxy agent from ${httpProxyUrl}: ${error}`);
        }
      }
      if (httpsProxyUrl) {
        options.agent ??= {};
        try {
          options.agent.https = new HttpsProxyAgent({
            keepAlive: true,
            keepAliveMsecs: 1000,
            maxSockets: 256,
            maxFreeSockets: 256,
            scheduling: 'lifo',
            proxy: httpsProxyUrl,
          });
        } catch (error) {
          throw new Error(`Failed to create https proxy agent from ${httpsProxyUrl}: ${error}`);
        }
      }
    }
    return options;
  }
}
