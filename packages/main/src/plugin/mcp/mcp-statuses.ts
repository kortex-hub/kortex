/**********************************************************************
 * Copyright (C) 2022-2025 Red Hat, Inc.
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

import { type MCPConfigurations, MCPInstance, MCPManager, type Storage as MCPStorage } from '@kortex-hub/mcp-manager';
import { inject, injectable } from 'inversify';

import { ApiSenderType } from '/@/plugin/api.js';
import { MCPPersistentStorage } from '/@/plugin/mcp/mcp-persistent-storage.js';
import type { MCPConfigInfo } from '/@api/mcp/mcp-config-info.js';
import { MCPEvents } from '/@api/mcp/mcp-events.js';

@injectable()
export class MCPStatuses {
  constructor(
    @inject(ApiSenderType)
    private apiSender: ApiSenderType,
    @inject(MCPPersistentStorage)
    private readonly storage: MCPStorage,
    @inject(MCPManager)
    private readonly mcpManager: MCPManager,
  ) {}

  init(): void {
    this.mcpManager.onUpdate(event => {
      switch (event.type) {
        case 'register':
          return this.apiSender.send(MCPEvents.MCP_REGISTERED);
        case 'unregister':
          return this.apiSender.send(MCPEvents.MCP_UNREGISTERED);
        case 'start':
          return this.apiSender.send(MCPEvents.MCP_START);
        case 'stop':
          return this.apiSender.send(MCPEvents.MCP_STOP);
      }
    });
  }

  public async collect(): Promise<Array<MCPConfigInfo>> {
    // Get config from storage
    const configs: Array<MCPConfigurations> = await this.storage.values();

    // create a Map instance to easily check if a configIf has a corresponding instance
    const instances: Map<string, MCPInstance> = new Map(
      this.mcpManager.all().map(instance => [instance.configId, instance]),
    );

    // map to MCPConfigInfo
    return configs.map(config => {
      return {
        id: config.id,
        status: instances.has(config.id) ? 'running' : 'stopped',
        type: config.type,
        name: config.name,
        version: config.version,
        registryURL: config.registryURL,
        serverId: config.serverId,
      };
    });
  }
}
