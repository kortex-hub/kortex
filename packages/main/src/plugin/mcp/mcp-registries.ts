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
import { inject, injectable } from 'inversify';

import { IConfigurationNode, IConfigurationRegistry } from '/@api/configuration/models.js';

import { ApiSenderType } from '../api.js';
import { Emitter } from '../events/emitter.js';
import { Telemetry } from '../telemetry/telemetry.js';
import { Disposable } from '../types/disposable.js';

type InternalMCPRegistry = kortexAPI.MCPRegistry & { save: boolean };

const MCP_SECTION_NAME = 'mcp';
const MCP_REGISTRIES = 'registries';

/**
 * Store all MCP Registries
 */
@injectable()
export class McpRegistries {
  private registries: InternalMCPRegistry[] = [];
  private suggestedRegistries: kortexAPI.RegistrySuggestedProvider[] = [];
  private providers: Map<string, kortexAPI.MCPRegistryProvider> = new Map();

  private readonly _onDidRegisterRegistry = new Emitter<kortexAPI.MCPRegistry>();
  private readonly _onDidUpdateRegistry = new Emitter<kortexAPI.MCPRegistry>();
  private readonly _onDidUnregisterRegistry = new Emitter<kortexAPI.MCPRegistry>();

  readonly onDidRegisterRegistry: kortexAPI.Event<kortexAPI.MCPRegistry> = this._onDidRegisterRegistry.event;
  readonly onDidUpdateRegistry: kortexAPI.Event<kortexAPI.MCPRegistry> = this._onDidUpdateRegistry.event;
  readonly onDidUnregisterRegistry: kortexAPI.Event<kortexAPI.MCPRegistry> = this._onDidUnregisterRegistry.event;

  private configuration: kortexAPI.Configuration;

  constructor(
    @inject(ApiSenderType)
    private apiSender: ApiSenderType,
    @inject(Telemetry)
    private telemetryService: Telemetry,
    @inject(IConfigurationRegistry)
    private configurationRegistry: IConfigurationRegistry,
  ) {
    const mcpRegistriesConfiguration: IConfigurationNode = {
      id: 'preferences.mcp',
      title: 'MCP',
      type: 'object',
      properties: {
        [`${MCP_SECTION_NAME}.${MCP_REGISTRIES}`]: {
          description: 'MCP registries',
          type: 'array',
          hidden: true,
        },
      },
    };
    this.configurationRegistry.registerConfigurations([mcpRegistriesConfiguration]);

    this.configuration = this.configurationRegistry.getConfiguration(MCP_SECTION_NAME);
  }

  init(): void {
    console.log('[MCPRegistries] init');
    this.loadRegistriesFromConfig();
  }

  getRegistryHash(registry: { serverUrl: string }): string {
    return crypto.createHash('sha512').update(registry.serverUrl).digest('hex');
  }

  registerMCPRegistry(registry: kortexAPI.MCPRegistry, save: boolean): Disposable {
    console.log(`[MCPRegistries] registerMCPRegistry ${registry.serverUrl}`);
    const found = this.registries.find(reg => reg.serverUrl === registry.serverUrl);
    if (found) {
      // Ignore and don't register - extension may register registries every time it is restarted
      console.log('Registry already registered, skipping registration');
      return Disposable.noop();
    }
    this.registries = [...this.registries, { ...registry, save }];
    if (save) {
      this.saveRegistriesToConfig();
    }
    this.telemetryService.track('registerRegistry', {
      serverUrl: this.getRegistryHash(registry),
      total: this.registries.length,
    });
    this.apiSender.send('mcp-registry-register', registry);
    this._onDidRegisterRegistry.fire(Object.freeze({ ...registry }));
    return Disposable.create(() => {
      this.unregisterMCPRegistry(registry, save);
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

  unregisterMCPRegistry(registry: kortexAPI.MCPRegistry, save: boolean): void {
    const filtered = this.registries.filter(registryItem => registryItem.serverUrl !== registry.serverUrl);
    if (filtered.length !== this.registries.length) {
      this._onDidUnregisterRegistry.fire(Object.freeze({ ...registry }));
      this.registries = filtered;
      if (save) {
        this.saveRegistriesToConfig();
      }
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

      return this.registerMCPRegistry(registryCreateOptions, true);
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

  private loadRegistriesFromConfig(): void {
    this.registries = (this.configuration.get<kortexAPI.MCPRegistry[]>(MCP_REGISTRIES) ?? []).map(registry => ({
      ...registry,
      save: true,
    }));
  }

  private saveRegistriesToConfig(): void {
    this.configuration
      .update(
        MCP_REGISTRIES,
        this.registries.filter(registry => registry.save).map(registry => ({ serverUrl: registry.serverUrl })),
      )
      .catch(console.error);
  }
}
