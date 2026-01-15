/**********************************************************************
 * Copyright (C) 2024-2025 Red Hat, Inc.
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

import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';

import { type ChunkProvider, ProviderRagConnection } from '@kortex-app/api';
import { inject, injectable } from 'inversify';

import { ApiSenderType } from '/@/plugin/api.js';
import { ChunkProviderRegistry } from '/@/plugin/chunk-provider-registry.js';
import { MCPManager } from '/@/plugin/mcp/mcp-manager.js';
import { INTERNAL_PROVIDER_ID } from '/@/plugin/mcp/mcp-registry.js';
import { ProviderRegistry } from '/@/plugin/provider-registry.js';
import { TaskManager } from '/@/plugin/tasks/task-manager.js';
import { Uri } from '/@/plugin/types/uri.js';
import { FileInfo, RagEnvironment } from '/@api/rag/rag-environment.js';

import { Directories } from './directories.js';

@injectable()
export class RagEnvironmentRegistry {
  #ragDirectory: string;
  #environments: RagEnvironment[] = [];

  constructor(
    @inject(ApiSenderType)
    private apiSender: ApiSenderType,
    @inject(Directories)
    private directories: Directories,
    @inject(ChunkProviderRegistry)
    private chunkProviderRegistry: ChunkProviderRegistry,
    @inject(ProviderRegistry)
    private providerRegistry: ProviderRegistry,
    @inject(TaskManager)
    private taskManager: TaskManager,
    @inject(MCPManager)
    private mcpManager: MCPManager,
  ) {
    // Create the rag directory inside the kortex home directory
    this.#ragDirectory = resolve(this.directories.getConfigurationDirectory(), '..', 'rag');
    this.providerRegistry.onDidRegisterRagConnection(this.refreshEnvironments.bind(this));
    this.providerRegistry.onDidUnregisterRagConnection(this.refreshEnvironments.bind(this));
  }

  async init(): Promise<void> {
    return this.loadEnvironments();
  }

  private async loadEnvironments(): Promise<void> {
    this.#environments = [];
    try {
      const files = await readdir(this.#ragDirectory);

      for (const file of files) {
        if (file.endsWith('.json')) {
          const name = basename(file, '.json');
          const ragEnvironment = await this.loadEnvironment(name);
          if (ragEnvironment) {
            this.#environments.push(ragEnvironment);
          }
        }
      }
    } catch (error) {
      console.error('Failed to read RAG environments:', error);
    }
  }

  private async refreshEnvironments(): Promise<void> {
    for (const environment of this.#environments) {
      try {
        await this.ensureMCPServer(environment);
      } catch (err: unknown) {
        console.error(`Failed to ensure MCP server for RAG environment ${environment.name}:`, err);
      }
    }
  }

  private async ensureRagDirectoryExists(): Promise<void> {
    await mkdir(this.#ragDirectory, { recursive: true });
  }

  private getRagEnvironmentFilePath(name: string): string {
    return resolve(this.#ragDirectory, `${name}.json`);
  }

  /**
   * Create or update a RAG environment
   * @param ragEnvironment The RAG environment to save
   */
  public async saveOrUpdate(ragEnvironment: RagEnvironment): Promise<void> {
    await this.ensureRagDirectoryExists();
    const filePath = this.getRagEnvironmentFilePath(ragEnvironment.name);
    await writeFile(
      filePath,
      JSON.stringify(ragEnvironment, (key, val) => (key !== 'mcpServer' ? val : undefined), 2),
    );
    const index = this.#environments.findIndex(env => env.name === ragEnvironment.name);
    if (index !== -1) {
      this.#environments[index] = ragEnvironment;
    } else {
      this.#environments.push(ragEnvironment);
    }
    this.apiSender.send('rag-environment-updated', { name: ragEnvironment.name });
  }

  /**
   * Get a RAG environment by name
   * @param name The name of the RAG environment
   * @returns The RAG environment or undefined if not found
   */
  public async loadEnvironment(name: string): Promise<RagEnvironment | undefined> {
    const filePath = this.getRagEnvironmentFilePath(name);
    if (!existsSync(filePath)) {
      return undefined;
    }

    try {
      const content = await readFile(filePath, 'utf-8');
      const environment = JSON.parse(content) as RagEnvironment;
      try {
        await this.ensureMCPServer(environment);
      } catch (err: unknown) {
        console.error(`Failed to ensure MCP server for RAG environment ${name}:`, err);
      }
      return environment;
    } catch (error) {
      console.error(`Failed to read RAG environment ${name}:`, error);
      return undefined;
    }
  }

  private async ensureMCPServer(environment: RagEnvironment): Promise<void> {
    if (!environment.mcpServer) {
      const ragConnection = this.getRagConnection(environment);
      if (ragConnection) {
        const serverId = ragConnection.connection.mcpServer.serverId;
        environment.mcpServer = this.mcpManager.findMcpRemoteServer(
          INTERNAL_PROVIDER_ID,
          serverId,
          ragConnection.connection.mcpServer.config.type,
          ragConnection.connection.mcpServer.config.index,
        );
      }
    }
  }

  public getEnvironment(name: string): RagEnvironment | undefined {
    return this.#environments.find(environment => environment.name === name);
  }

  /**
   * Get all RAG environments
   * @returns Array of all RAG environments
   */
  public async getAllRagEnvironments(): Promise<RagEnvironment[]> {
    return this.#environments;
  }

  /**
   * Delete a RAG environment
   * @param name The name of the RAG environment to delete
   * @returns true if the environment was deleted, false otherwise
   */
  public async deleteRagEnvironment(name: string): Promise<boolean> {
    const filePath = this.getRagEnvironmentFilePath(name);
    if (!existsSync(filePath)) {
      return false;
    }

    try {
      await unlink(filePath);
      this.#environments = this.#environments.filter(environment => environment.name !== name);
      this.apiSender.send('rag-environment-deleted', { name });
      return true;
    } catch (error) {
      console.error(`Failed to delete RAG environment ${name}:`, error);
      return false;
    }
  }

  /**
   * Check if a RAG environment exists
   * @param name The name of the RAG environment
   * @returns true if the environment exists, false otherwise
   */
  public hasRagEnvironment(name: string): boolean {
    const filePath = this.getRagEnvironmentFilePath(name);
    return existsSync(filePath);
  }

  /**
   * Add a file to the RAG environment's pending files
   * @param name The name of the RAG environment
   * @param filePath The path of the file to add
   * @returns true if the file was added successfully, false otherwise
   */
  public async addFileToPendingFiles(name: string, filePath: string): Promise<boolean> {
    const ragEnvironment = this.getEnvironment(name);
    if (!ragEnvironment) {
      console.error(`RAG environment ${name} not found`);
      return false;
    }

    // Check if file is already in indexed or pending files
    if (ragEnvironment.files.some(file => file.path === filePath)) {
      console.warn(`File ${filePath} is already in RAG environment ${name}`);
      return false;
    }

    const chunkProvider = this.chunkProviderRegistry.findProviderById(ragEnvironment.chunkerId);
    if (!chunkProvider) {
      console.error(`Chunk provider with ID ${ragEnvironment.chunkerId} not found`);
      return false;
    }

    const ragConnection = this.getRagConnection(ragEnvironment);
    if (!ragConnection) {
      console.error(`Rag connection ${ragEnvironment.ragConnection.name} not found`);
      return false;
    }

    const fileInfo: FileInfo = { path: filePath, status: 'pending' };

    this.indexFile(ragEnvironment, fileInfo, chunkProvider, ragConnection).catch((err: unknown) =>
      console.error(`Error indexing file: ${filePath}`, err),
    );

    // Add file to pending files
    ragEnvironment.files.push(fileInfo);

    try {
      await this.saveOrUpdate(ragEnvironment);
      return true;
    } catch (error) {
      console.error(`Failed to add file to RAG environment ${name}:`, error);
      return false;
    }
  }

  private getRagConnection(ragEnvironment: RagEnvironment): ProviderRagConnection | undefined {
    return this.providerRegistry
      .getRagConnections()
      .find(
        connection =>
          connection.providerId === ragEnvironment.ragConnection.providerId &&
          connection.connection.name === ragEnvironment.ragConnection.name,
      );
  }

  private async indexFile(
    ragEnvironment: RagEnvironment,
    fileInfo: FileInfo,
    chunkProvider: ChunkProvider,
    ragConnection: ProviderRagConnection,
  ): Promise<void> {
    const chunkTask = this.taskManager.createTask({
      title: `Chunking ${fileInfo.path} on ${ragEnvironment.name}`,
    });
    chunkTask.state = 'running';
    chunkTask.status = 'in-progress';
    try {
      const chunks = await chunkProvider.chunk(Uri.file(fileInfo.path));
      chunkTask.status = 'success';
      const indexTask = this.taskManager.createTask({
        title: `Indexing ${fileInfo.path} on ${ragEnvironment.name}`,
      });
      indexTask.state = 'running';
      indexTask.status = 'in-progress';
      try {
        await ragConnection.connection.index(
          Uri.file(fileInfo.path),
          chunks.map(chunk => chunk.text),
        );
        fileInfo.status = 'indexed';
        await this.saveOrUpdate(ragEnvironment);
        indexTask.status = 'success';
      } catch (err: unknown) {
        indexTask.status = 'failure';
        indexTask.error = String(err);
      } finally {
        indexTask.state = 'completed';
      }
    } catch (err: unknown) {
      chunkTask.status = 'failure';
      chunkTask.error = String(err);
    } finally {
      chunkTask.state = 'completed';
    }
  }

  async createEnvironment(
    name: string,
    ragConnection: { name: string; providerId: string },
    chunkerId: string,
  ): Promise<void> {
    const ragEnvironment: RagEnvironment = {
      name,
      ragConnection,
      chunkerId,
      files: [],
      mcpServer: undefined,
    };
    await this.ensureMCPServer(ragEnvironment);
    return this.saveOrUpdate(ragEnvironment);
  }
}
