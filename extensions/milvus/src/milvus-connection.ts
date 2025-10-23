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

import type { MCPServerDetail } from '@kortex-app/api';
import * as api from '@kortex-app/api';

export class MilvusConnection implements api.RagProviderConnection {
  private connectionStatus: api.ProviderConnectionStatus;

  constructor(
    public readonly name: string,
    private containerId: string,
    private port: number,
    running: boolean,
  ) {
    this.connectionStatus = running ? 'started' : 'stopped';
    // Bind lifecycle methods
    this.lifecycle = {
      start: this.startContainer.bind(this),
      stop: this.stopContainer.bind(this),
      delete: this.deleteContainer.bind(this),
    };
    const server: MCPServerDetail = {
        name: 'mcp-server-milvus',
        version: '0.1.1',
        description: 'Milvus MCP Server for RAG',
        status: 'active',
        packages: [
          {
            registryType: 'pypi',
            identifier: 'mcp-server-milvus',
            version: '0.1.1',
            runtimeHint: 'python',
            packageArguments: [{
              isRequired: true,
              format: 'string',
              value: '--milvus-uri',
              isSecret: false,
            },
              {
                isRequired: true,
                format: 'string',
                value: `http://localhost:${port}`,
                isSecret: false,
              }],
          },
        ],
    };
    this.mcpServer = {
      server,
      config: {
        type: 'package',
        package: server.packages![0],
        runtimeArguments: {},
        packageArguments: {},
        environmentVariables: {},
      },
    };

  }

  status(): api.ProviderConnectionStatus {
    return this.connectionStatus;
  }

  credentials(): Record<string, string> {
    return {};
  }

  lifecycle!: api.ProviderConnectionLifecycle;

  mcpServer: api.MCPServer;

  private async startContainer(startContext: api.LifecycleContext): Promise<void> {
    startContext.log.log('Starting Milvus connection...');
    // Start the container using podman CLI
    try {
      await api.process.exec('podman', ['start', this.containerId]);
      startContext.log.log('Container started successfully');
    } catch (err) {
      startContext.log.error(`Failed to start container: ${err}`);
      throw new Error(`Failed to start container: ${err}`);
    }
  }

  private async stopContainer(stopContext: api.LifecycleContext): Promise<void> {
    stopContext.log.log('Stopping Milvus connection...');
    // Stop the container using podman CLI
    try {
      await api.process.exec('podman', ['stop', this.containerId]);
      stopContext.log.log('Container stopped successfully');
    } catch (err) {
      stopContext.log.error(`Failed to stop container: ${err}`);
      throw new Error(`Failed to stop container: ${err}`);
    }
  }

  private async deleteContainer(logger?: api.Logger): Promise<void> {
    logger?.log('Deleting Milvus connection...');
    // Delete the container using podman CLI
    try {
      await api.process.exec('podman', ['rm', '-f', this.containerId]);
      logger?.log('Container deleted successfully');
    } catch (err) {
      logger?.error(`Failed to delete container: ${err}`);
      throw new Error(`Failed to delete container: ${err}`);
    }
  }

  getContainerId(): string {
    return this.containerId;
  }

  updateStatus(status: api.ProviderConnectionStatus): void {
    this.connectionStatus = status;
  }
}
