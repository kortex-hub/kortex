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
import type * as kortexAPI from '@kortex-app/api';
import { MCPRegistryClient } from '@kortex-hub/mcp-registry-client';
import { inject, injectable } from 'inversify';

import { McpRegistries } from '/@/plugin/mcp/mcp-registries.js';

@injectable()
export class MCPRegistriesClients {
  #clients: Map<string, MCPRegistryClient> = new Map();

  constructor(
    @inject(McpRegistries)
    private readonly mcpRegistries: McpRegistries,
  ) {}

  protected registerMCPRegistry(registry: kortexAPI.MCPRegistry): void {
    this.#clients.set(
      registry.serverUrl,
      new MCPRegistryClient({
        baseURL: registry.serverUrl,
      }));
  }

  protected registerSuggestedMCPRegistry(registry: kortexAPI.MCPRegistrySuggestedProvider): void {
    this.#clients.set(
      registry.url,
      new MCPRegistryClient({
        baseURL: registry.url,
      }));
  }

  public getClient(url: string): MCPRegistryClient {
    const client = this.#clients.get(url);
    if(!client) throw new Error(`No client found for ${url}`);
    return client;
  }

  init(): void {
    this.mcpRegistries.onDidRegisterRegistry(this.registerMCPRegistry.bind(this));

    this.mcpRegistries.onDidUnregisterRegistry((registry: kortexAPI.MCPRegistry) => {
      this.#clients.delete(registry.serverUrl);
    });

    // create clients for suggested MCP Registries
    this.mcpRegistries.getSuggestedRegistries().forEach(this.registerSuggestedMCPRegistry.bind(this));

    // create clients for MCP Registries
    this.mcpRegistries.getRegistries().forEach(this.registerMCPRegistry.bind(this));
  }
}
