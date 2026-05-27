/**********************************************************************
 * Copyright (C) 2026 Red Hat, Inc.
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
import { randomInt } from 'node:crypto';
import { openAsBlob } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';

import type {
  Chunk,
  ChunkProviderConnection,
  ChunkProviderConnectionFactory,
  Disposable,
  ExtensionContext,
  Logger,
  Provider,
  ProviderConnectionStatus,
} from '@openkaiden/api';
import { Uri } from '@openkaiden/api';
import type { ContainerExtensionAPI } from '@openkaiden/container-extension-api';
// eslint-disable-next-line import/no-extraneous-dependencies
import type Dockerode from 'dockerode';
import { inject, injectable } from 'inversify';

import { ContainerExtensionAPISymbol, DoclingProviderSymbol, ExtensionContextSymbol } from '/@/inject/symbol';

const DOCLING_IMAGE = `quay.io/docling-project/docling-serve:v1.9.0`;
const DOCLING_PORT = 5001;
const DOCLING_NAME_LABEL = 'ai.openkaiden.docling.name';
const DOCLING_PORT_LABEL = 'ai.openkaiden.docling.port';

type DoclingContainerInfo = {
  dockerode: Dockerode;
  containerId: string;
  port: number;
};

type DoclingConnectionEntry = {
  containerInfo: DoclingContainerInfo;
  disposable: Disposable;
  workspacePath: string;
  processedDocuments: number;
  connectionStatus: ProviderConnectionStatus;
};

function getRandomPort(): number {
  return randomInt(1024, 65536);
}

@injectable()
export class ConnectionManager {
  @inject(ExtensionContextSymbol)
  private extensionContext!: ExtensionContext;

  @inject(ContainerExtensionAPISymbol)
  private containerExtensionAPI!: ContainerExtensionAPI;

  @inject(DoclingProviderSymbol)
  private doclingProvider!: Provider;

  #connections: Map<string, DoclingConnectionEntry> = new Map();
  #subscriptions: Disposable[] = [];

  async init(): Promise<void> {
    await this.discoverExistingConnections();
    this.#subscriptions.push(
      this.containerExtensionAPI.onContainersChanged(this.discoverExistingConnections.bind(this)),
    );
    this.#subscriptions.push(
      this.containerExtensionAPI.onEndpointsChanged(this.discoverExistingConnections.bind(this)),
    );

    const chunkFactory: ChunkProviderConnectionFactory = {
      creationDisplayName: 'Docling Chunk Provider',
      create: this.factory.bind(this),
    };

    this.extensionContext.subscriptions.push(this.doclingProvider.setChunkProviderConnectionFactory(chunkFactory));
  }

  dispose(): void {
    this.#connections.forEach((entry, _key) => entry.disposable.dispose());
    this.#subscriptions.forEach(subscription => subscription.dispose());
    this.#connections.clear();
  }

  async registerConnection(info: {
    path: string;
    containerId: string;
    name: string;
    port: number;
    running: boolean;
  }): Promise<void> {
    const key = `${info.path}::${info.containerId}`;
    const existingEntry = this.#connections.get(key);

    if (existingEntry) {
      existingEntry.connectionStatus = info.running ? 'started' : 'stopped';
      return;
    }

    const workspacePath = join(this.extensionContext.storagePath, info.name);
    await mkdir(workspacePath, { recursive: true });
    const dockerode = this.containerExtensionAPI.getEndpoints().find(ep => ep.path === info.path)!.dockerode;
    const containerInfo: DoclingContainerInfo = {
      dockerode,
      containerId: info.containerId,
      port: info.port,
    };

    const entry: DoclingConnectionEntry = {
      containerInfo,
      disposable: undefined!,
      workspacePath,
      processedDocuments: 0,
      connectionStatus: info.running ? 'started' : 'stopped',
    };

    const connection: ChunkProviderConnection = {
      id: `docling-${info.name}`,
      name: info.name,
      chunk: (doc: Uri): Promise<Chunk[]> => this.convertDocumentForConnection(entry, doc),
      status: (): ProviderConnectionStatus => entry.connectionStatus,
      lifecycle: {
        start: async (): Promise<void> => {
          await containerInfo.dockerode.getContainer(containerInfo.containerId).start();
          entry.connectionStatus = 'started';
        },
        stop: async (): Promise<void> => {
          await containerInfo.dockerode.getContainer(containerInfo.containerId).stop();
          entry.connectionStatus = 'stopped';
        },
        delete: async (): Promise<void> => {
          try {
            await containerInfo.dockerode.getContainer(containerInfo.containerId).remove();
          } catch {
            // Container may already be removed
          }
          entry.disposable.dispose();
          this.#connections.delete(key);
          await rm(workspacePath, { recursive: true, force: true });
        },
      },
    };

    entry.disposable = this.doclingProvider.registerChunkProviderConnection(connection);
    this.#connections.set(key, entry);
  }

  async discoverExistingConnections(): Promise<void> {
    try {
      const existingKeys = Array.from(this.#connections.keys());
      for (const endpoint of this.containerExtensionAPI.getEndpoints()) {
        const containers = await endpoint.dockerode.listContainers({ all: true });
        for (const container of containers) {
          const doclingName = container.Labels?.[DOCLING_NAME_LABEL];
          const doclingPort = container.Labels?.[DOCLING_PORT_LABEL];

          if (doclingName && doclingPort) {
            await this.registerConnection({
              path: endpoint.path,
              containerId: container.Id,
              name: doclingName,
              port: parseInt(doclingPort, 10),
              running: container.State === 'running',
            });
            const idx = existingKeys.indexOf(`${endpoint.path}::${container.Id}`);
            if (idx >= 0) {
              existingKeys.splice(idx, 1);
            }
          }
        }
      }
      for (const key of existingKeys) {
        const entry = this.#connections.get(key);
        if (entry) {
          entry.disposable.dispose();
          this.#connections.delete(key);
        }
      }
    } catch (err: unknown) {
      console.error(`Failed to discover connections: ${err}`);
    }
  }

  async convertDocumentForConnection(entry: DoclingConnectionEntry, docUri: Uri): Promise<Chunk[]> {
    if (entry.connectionStatus !== 'started') {
      throw new Error('Docling container is not running');
    }

    const docPath = docUri.fsPath;
    const docFileName = basename(docPath);

    const data = new FormData();
    const blob = await openAsBlob(docPath);
    data.set('files', blob, docFileName);
    const response = await fetch(`http://localhost:${entry.containerInfo.port}/v1/chunk/hierarchical/file`, {
      method: 'POST',
      body: data,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Conversion failed: ${response.status} ${error}`);
    }

    const res = await response.json();

    const chunks: Chunk[] = [];
    const documentNumber = entry.processedDocuments++;
    if (typeof res === 'object' && res && 'chunks' in res && Array.isArray(res.chunks)) {
      for (let i = 0; i < res.chunks.length; i++) {
        const chunkPath = join(entry.workspacePath, `doc${documentNumber}-chunk${i}.txt`);
        await writeFile(chunkPath, res.chunks[i].text, 'utf-8');
        chunks.push({
          text: Uri.file(chunkPath),
        });
      }
    }

    return chunks;
  }

  private async checkDoclingImage(dockerode: Dockerode): Promise<boolean> {
    try {
      await dockerode.getImage(DOCLING_IMAGE).inspect();
      return true;
    } catch {
      return false;
    }
  }

  private async pullDoclingImage(dockerode: Dockerode): Promise<void> {
    const promise = Promise.withResolvers<void>();
    try {
      const stream = await dockerode.pull(DOCLING_IMAGE);
      const onFinished = (err: Error | null): void => {
        if (err) {
          promise.reject(err);
          return;
        }
        promise.resolve();
      };
      dockerode.modem.followProgress(stream, onFinished);
    } catch (err: unknown) {
      throw new Error(`Failed to pull Docling image ${DOCLING_IMAGE}: ${err}`);
    }
    return promise.promise;
  }

  async factory(params: { [key: string]: unknown }, logger?: Logger): Promise<void> {
    logger?.log('Creating Docling chunk provider connection...');

    const name = params['docling.name'] as string;
    if (!name) {
      throw new Error('Name parameter is required');
    }

    logger?.log(`Connection name: ${name}`);

    const workspacePath = join(this.extensionContext.storagePath, name);
    await mkdir(workspacePath, { recursive: true });

    const endpoint = this.containerExtensionAPI.getEndpoints()[0];
    if (!endpoint) {
      throw new Error('No container endpoint available');
    }
    const dockerode = endpoint.dockerode;

    const isImageAvailable = await this.checkDoclingImage(dockerode);
    if (!isImageAvailable) {
      await this.pullDoclingImage(dockerode);
    }

    const port = getRandomPort();
    const containerName = `docling-${name}`;

    logger?.log(`Starting Docling container ${containerName} on port ${port}...`);
    const container = await dockerode.createContainer({
      name: containerName,
      Labels: {
        [DOCLING_NAME_LABEL]: name,
        [DOCLING_PORT_LABEL]: `${port}`,
      },
      Image: DOCLING_IMAGE,
      Env: ['UVICORN_WORKERS=1'],
      HostConfig: {
        AutoRemove: false,
        PortBindings: {
          [`${DOCLING_PORT}/tcp`]: [{ HostPort: `${port}` }],
        },
      },
    });
    await container.start();
    logger?.log(`Container started with ID: ${container.id}`);

    let started = false;
    let retries = 0;
    while (!started && retries++ < 60) {
      try {
        const response = await fetch(`http://localhost:${port}/health`);
        if (response.ok) {
          started = true;
        }
      } catch {
        // Not ready yet
      }
      if (!started) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    if (!started) {
      throw new Error('Failed to start Docling container');
    }

    await this.registerConnection({
      path: endpoint.path,
      containerId: container.id,
      name,
      port,
      running: true,
    });

    logger?.log(`Docling chunk provider connection '${name}' created successfully`);
  }
}
