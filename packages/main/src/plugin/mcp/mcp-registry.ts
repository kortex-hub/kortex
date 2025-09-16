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
import { SecretStorage } from '@kortex-app/api';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { HttpsOptions, OptionsOfTextResponseBody } from 'got';
import { HttpProxyAgent, HttpsProxyAgent } from 'hpagent';
import { inject, injectable } from 'inversify';
import type { components } from 'mcp-registry';

import { SafeStorageRegistry } from '/@/plugin/safe-storage/safe-storage-registry.js';
import { MCPServerDetail } from '/@api/mcp/mcp-server-info.js';

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

interface StorageConfigFormat {
  serverId: string;
  remoteId: number;
  headers: { [key: string]: string };
}

const STORAGE_KEY = 'mcp:registry:configurations';
export const INTERNAL_PROVIDER_ID = 'internal';

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

  private safeStorage: SecretStorage | undefined = undefined;

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
    @inject(SafeStorageRegistry)
    private safeStorageRegistry: SafeStorageRegistry,
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

  init(): void {
    console.log('[MCPRegistry] init');
    this.safeStorage = this.safeStorageRegistry.getCoreStorage();

    this.onDidRegisterRegistry(async registry => {
      const configurations = await this.getConfigurations();
      console.log(`[MCPRegistry] found ${configurations.length} saved configurations`);

      // serverId => config
      const mapping: Map<string, StorageConfigFormat> = new Map(
        configurations.map(config => [config.serverId, config]),
      );

      const { servers } = await this.listMCPServersFromRegistry(registry.serverUrl);
      for (const server of servers) {
        if (!server.id) {
          continue;
        }
        const config = mapping.get(server.id);
        if (!config) {
          continue;
        }

        const remote = server.remotes?.[config.remoteId];
        if (!remote) {
          continue;
        }

        // client already exists ?
        const existingServers = await this.mcpManager.listMCPRemoteServers();
        const existing = existingServers.find(srv => srv.id.includes(server.id ?? 'unknown'));
        if (existing) {
          console.log(`[MCPRegistry] MCP client for server ${server.id} already exists, skipping`);
          continue;
        }

        // create transport
        const transport = new StreamableHTTPClientTransport(new URL(remote.url), {
          requestInit: {
            headers: config.headers,
          },
        });

        await this.mcpManager.registerMCPClient(
          INTERNAL_PROVIDER_ID,
          server.id,
          config.remoteId,
          server.name,
          transport,
          remote.url,
        );
      }
    });
  }

  getRegistryHash(registry: { serverUrl: string }): string {
    return crypto.createHash('sha512').update(registry.serverUrl).digest('hex');
  }

  registerMCPRegistry(registry: kortexAPI.MCPRegistry): Disposable {
    console.log(`[MCPRegistry] registerMCPRegistry ${registry.serverUrl}`);
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

    this._onDidRegisterRegistry.fire({
      name: registry.name,
      serverUrl: registry.url,
      icon: registry.icon,
      alias: undefined,
    });

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

    await this.mcpManager.registerMCPClient(INTERNAL_PROVIDER_ID, serverId, remoteId, name, transport, remote.url);

    // persist configuration
    await this.saveConfiguration({
      serverId,
      remoteId,
      headers,
    });
  }

  public async getCredentials(
    serverId: string,
    remoteId: number,
  ): Promise<{
    headers: Record<string, string>;
  }> {
    const configs = await this.getConfigurations();

    const configuration = configs.find(item => item.serverId === serverId && item.remoteId === remoteId);
    if (!configuration) throw new Error(`Configuration not found for serverId ${serverId} and remoteId ${remoteId}`);

    return {
      headers: configuration.headers,
    };
  }

  async getConfigurations(): Promise<Array<StorageConfigFormat>> {
    const raw = await this.safeStorage?.get(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  }

  async saveConfiguration(config: StorageConfigFormat): Promise<void> {
    console.log(`saving ${config.serverId} ${config.remoteId}`);
    const existing = await this.getConfigurations();
    await this.safeStorage?.store(STORAGE_KEY, JSON.stringify([...existing, config]));
  }

  async deleteMcpFromConfiguration(serverId: string, remoteId: number): Promise<void> {
    const existingConfiguration = await this.getConfigurations();
    const filtered = existingConfiguration.filter(
      config => !(config.serverId === serverId && config.remoteId === remoteId),
    );
    await this.safeStorage?.store(STORAGE_KEY, JSON.stringify(filtered));
  }

  protected async listMCPServersFromRegistry(registryURL: string): Promise<components['schemas']['ServerList']> {
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
    return await content.json();
  }

  async listMCPServersFromRegistries(): Promise<Array<MCPServerDetail>> {
    // connect to each registry and grab server details
    const serverDetails: Array<MCPServerDetail> = [];

    // merge all urls to inspect
    const serverUrls: string[] = this.registries
      .map(registry => registry.serverUrl)
      .concat(this.suggestedRegistries.map(registry => registry.url));

    for (const registryURL of serverUrls) {
      const serverList: components['schemas']['ServerList'] = await this.listMCPServersFromRegistry(registryURL);

      // now, aggregate the servers from the list adding an id being a sha of registryURL::server.name
      serverDetails.push(
        ...serverList.servers.map(server => {
          let id = '';
          // is there a "_meta": {
          // "io.modelcontextprotocol.registry/official": {
          // "id": "..."
          // field  we can use as id ?
          if (server._meta?.['io.modelcontextprotocol.registry/official']) {
            const official = server._meta['io.modelcontextprotocol.registry/official'];
            if (official.id) {
              id = official.id;
            }
          }
          if (!id) {
            const rawId = `${registryURL}::${server.name}`;
            id = crypto.createHash('sha256').update(rawId).digest('hex');
          }
          return { ...server, id };
        }),
      );
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
