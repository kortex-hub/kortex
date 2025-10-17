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

import { inject, injectable } from 'inversify';

import { RagEnvironment } from './rag-environment.js';

import { Directories } from './directories.js';
import { RagEnvironmentInfo } from '/@api/rag/rag-environment-info.js';
import { ProviderRegistry } from '/@/plugin/provider-registry.js';
import { ChunkProviderRegistry } from '/@/plugin/chunk-provider-registry.js';

@injectable()
export class RagEnvironmentRegistry {
  #ragDirectory: string;

  constructor(
    @inject(ProviderRegistry)
    private providerRegistry: ProviderRegistry,
    @inject(ChunkProviderRegistry)
    private chunkProviderRegistry: ChunkProviderRegistry,
    @inject(Directories)
    private directories: Directories,
  ) {
    // Create the rag directory inside the kortex home directory
    this.#ragDirectory = resolve(this.directories.getConfigurationDirectory(), '..', 'rag');
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
    return writeFile(filePath, JSON.stringify(ragEnvironment, undefined, 2));
  }

  /**
   * Get a RAG environment by name
   * @param name The name of the RAG environment
   * @returns The RAG environment or undefined if not found
   */
  public async getRagEnvironment(name: string): Promise<RagEnvironment | undefined> {
    const filePath = this.getRagEnvironmentFilePath(name);
    if (!existsSync(filePath)) {
      return undefined;
    }

    try {
      const content = await readFile(filePath, 'utf-8');
      return JSON.parse(content) as RagEnvironment;
    } catch (error) {
      console.error(`Failed to read RAG environment ${name}:`, error);
      return undefined;
    }
  }

  private resolveRagEnvironment(ragEnvironment: RagEnvironment): RagEnvironmentInfo {
    this.providerRegistry.getProviderFlowConnectionInfo()
  }

  /**
   * Get all RAG environments
   * @returns Array of all RAG environments
   */
  public async getAllRagEnvironments(): Promise<RagEnvironmentInfo[]> {

    try {
      const files = await readdir(this.#ragDirectory);
      const ragEnvironments: RagEnvironmentInfo[] = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const name = basename(file, '.json');
          const ragEnvironment = await this.getRagEnvironment(name);
          if (ragEnvironment) {
            ragEnvironments.push(resolve(ragEnvironment));
          }
        }
      }

      return ragEnvironments;
    } catch (error) {
      console.error('Failed to read RAG environments:', error);
      return [];
    }
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
}
