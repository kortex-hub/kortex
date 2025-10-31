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

import { copyFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';

import * as api from '@kortex-app/api';
import { Uri } from '@kortex-app/api';
import type { ContainerInfo } from 'dockerode';

const DOCLING_IMAGE = 'quay.io/jeffmaury/docling-kortex:latest';
const DOCLING_PORT = 8000;
const CONTAINER_NAME = 'docling-chunker';

type DoclingContainerInfo = {
  containerId: string;
  port: number;
  workspaceFolder: string;
};

export class Docling {
  private containerInfo: DoclingContainerInfo | undefined = undefined;

  constructor(private extensionContext: api.ExtensionContext) {}

  /**
   * Get a random port for the container
   */
  private getRandomPort(): number {
    return 1024 + Math.floor(Math.random() * (65535 - 1024));
  }

  async discoverExistingContainer(): Promise<DoclingContainerInfo | undefined> {
    console.log('Discovering existing Docling container...');

    try {
      // List all containers (running and stopped) with Docling labels
      const { stdout } = await api.process.exec('podman', ['ps', '-a', '--format', 'json']);

      if (!stdout || stdout.trim() === '') {
        console.log('No existing Docling containers found');
        return undefined;
      }

      const containerList = JSON.parse(stdout) as ContainerInfo[];

      for (const container of containerList) {
        const doclingPort = container.Labels?.['io.kortex.docling.port'];
        const doclingFolder = container.Labels?.['io.kortex.docling.folder'];

        if (doclingPort) {
          console.log(`Found container: (with port ${doclingPort}, state: ${container.State}`);
          return {
            containerId: container.Id,
            port: parseInt(doclingPort, 10),
            workspaceFolder: doclingFolder,
          };
        }
      }
    } catch (err: unknown) {
      console.error(`Failed to discover containers: ${err}`);
      return undefined;
    }
  }

  /**
   * Initialize the Docling chunker by starting the container
   */
  async init(): Promise<void> {
    console.log('Starting Docling container...');

    const existingContainer = await this.discoverExistingContainer();

    if (existingContainer) {
      this.containerInfo = existingContainer;
    } else {
      // Create a temporary workspace directory
      const tempWorkspaceDir = join(tmpdir(), 'docling-workspace-' + Date.now());
      await mkdir(tempWorkspaceDir, { recursive: true });
      console.log(`Created temporary workspace: ${tempWorkspaceDir}`);

      // Get a random port for the container
      const containerPort = this.getRandomPort();

      try {
        // Start the container
        const { stdout: cid } = await api.process.exec('podman', [
          'run',
          '-d',
          '--name',
          CONTAINER_NAME,
          '-v',
          `${tempWorkspaceDir}:/workspace`,
          '-p',
          `${containerPort}:${DOCLING_PORT}`,
          '-l',
          `io.kortex.docling.port=${containerPort}`,
          '-l',
          `io.kortex.docling.folder=${tempWorkspaceDir}`,
          DOCLING_IMAGE,
        ]);

        const containerId = cid.trim();
        console.log(`Container started with ID: ${containerId}`);
        console.log(`Container listening on port: ${containerPort}`);

        // Wait for the service to be healthy
        let started = false;
        while (!started) {
          try {
            const response = await fetch(`http://localhost:${containerPort}/health`);
            if (response.ok) {
              console.log('Docling service is healthy');
              started = true;
            } else {
              console.warn('Docling service health check returned non-OK status');
            }
          } catch (err) {
            console.warn(`Health check failed: ${err}`, err);
            // Wait a bit before retrying
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }

        this.containerInfo = {
          containerId,
          port: containerPort,
          workspaceFolder: tempWorkspaceDir,
        };
      } catch (err: unknown) {
        console.error(`Failed to start container: ${err}`);
        // Clean up temp directory on failure
        await rm(tempWorkspaceDir, { recursive: true, force: true }).catch(() => {});
        throw new Error(`Failed to start Docling container: ${err}`);
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    // Create the Docling chunk provider
    const doclingChunkProvider: api.ChunkProvider = {
      name: 'docling',
      async index(doc: api.Uri): Promise<api.Chunk[]> {
        try {
          return await self.convertDocument(doc);
        } catch (err) {
          console.error('Failed to convert document:', err);
          throw err;
        }
      },
    };

    // Register the chunk provider
    const disposable = api.rag.registerChunkProvider(doclingChunkProvider);

    // Add to subscriptions for proper cleanup
    this.extensionContext.subscriptions.push(disposable);
  }

  /**
   * Shutdown the Docling chunker by stopping and removing the container
   */
  async shutdown(): Promise<void> {
    if (!this.containerInfo) {
      return;
    }

    console.log('Stopping Docling container...');

    try {
      // Stop the container
      await api.process.exec('podman', ['stop', this.containerInfo.containerId]);
      console.log('Container stopped');

      // Remove the container
      await api.process.exec('podman', ['rm', this.containerInfo.containerId]);
      console.log('Container removed');
    } catch (err) {
      console.error(`Failed to stop container: ${err}`);
    }

    // Clean up temporary workspace
    try {
      await rm(this.containerInfo.workspaceFolder, { recursive: true, force: true });
      console.log('Temporary workspace cleaned up');
    } catch (err) {
      console.error(`Failed to clean up workspace: ${err}`);
    }

    this.containerInfo = undefined;
  }

  /**
   * Convert a document to chunks using the Docling service
   */
  async convertDocument(docUri: api.Uri): Promise<api.Chunk[]> {
    if (!this.containerInfo) {
      throw new Error('Docling container is not running');
    }

    // Create a unique folder for this document
    const folderName = `doc-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const folderPath = join(this.containerInfo.workspaceFolder, folderName);
    await mkdir(folderPath, { recursive: true });

    try {
      // Copy the document to the folder
      const docPath = docUri.fsPath;
      const docFileName = basename(docPath);
      const destPath = join(folderPath, docFileName);
      await copyFile(docPath, destPath);

      // Send conversion request to the service
      const response = await fetch(
        `http://localhost:${this.containerInfo.port}/convert?folder_name=${encodeURIComponent(folderName)}`,
        {
          method: 'GET',
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Conversion failed: ${response.status} ${errorText}`);
      }

      const result = (await response.json()) as {
        success: boolean;
        chunk_count: number;
        error: string | null;
      };

      if (!result.success) {
        throw new Error(`Conversion failed: ${result.error}`);
      }

      // Read the chunk files
      const chunks: api.Chunk[] = [];
      for (let i = 0; i < result.chunk_count; i++) {
        const chunkPath = join(folderPath, `chunk${i}.txt`);
        chunks.push({
          text: Uri.file(chunkPath),
        });
      }

      return chunks;
    } catch (err: unknown) {
      // Clean up the document folder
      await rm(folderPath, { recursive: true, force: true }).catch(() => {});
      throw err;
    }
  }
}
