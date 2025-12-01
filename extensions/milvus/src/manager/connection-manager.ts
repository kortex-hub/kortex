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
import { randomInt } from 'node:crypto';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

import {
  Disposable,
  ExtensionContext,
  LifecycleContext,
  Logger,
  Provider,
  ProviderConnectionLifecycle,
  RagProviderConnectionFactory,
} from '@kortex-app/api';
import { ContainerExtensionAPI } from '@kortex-app/container-extension-api';
// eslint-disable-next-line import/no-extraneous-dependencies
import Dockerode from 'dockerode';
import { inject, injectable } from 'inversify';

import { createConfigFile } from '/@/util/config';

import { MilvusConnection } from '../api/milvus-connection';
import { MilvusContainer } from '../api/milvus-container';
import { ContainerExtensionAPISymbol, ExtensionContextSymbol, MilvusProvider } from '../inject/symbol';

const MILVUS_IMAGE = 'docker.io/milvusdb/milvus:v2.6.3';
const MILVUS_PORT = 19530;

type ConnectionEntry = {
  connection: MilvusConnection;
  disposable: Disposable;
};

function getRandomPort(): number {
  return randomInt(1024, 65636);
}

@injectable()
export class ConnectionManager implements Disposable {
  @inject(ExtensionContextSymbol)
  private extensionContext!: ExtensionContext;

  @inject(ContainerExtensionAPISymbol)
  private containerExtensionAPI!: ContainerExtensionAPI;

  @inject(MilvusProvider)
  private milvusProvider!: Provider;

  #connections: Map<string, ConnectionEntry> = new Map();

  registerConnection(container: MilvusContainer): void {
    const connectionEntry = this.#connections.get(`${container.path}::${container.id}`);
    if (connectionEntry !== undefined) {
      connectionEntry.connection.updateStatus(container.running ? 'started' : 'stopped');
    } else {
      const connection = new MilvusConnection(
        container.path,
        container.name,
        container.id,
        container.port,
        container.running,
      );
      const lifecycle: ProviderConnectionLifecycle = {
        start: this.startConnection.bind(this, connection),
        stop: this.stopConnection.bind(this, connection),
        delete: this.deleteConnection.bind(this, connection),
      };
      connection.lifecycle = lifecycle;
      const disposable = this.milvusProvider.registerRagProviderConnection(connection);
      this.#connections.set(`${container.path}::${container.id}`, { connection, disposable });
    }
  }

  private getContainer(connection: MilvusConnection): Dockerode.Container | undefined {
    const entry = this.#connections.get(`${connection.path}::${connection.containerId}`);
    if (entry !== undefined) {
      const dockerode = this.containerExtensionAPI
        .getEndpoints()
        .find(endpoint => endpoint.path === connection.path)?.dockerode;
      if (dockerode) {
        return dockerode.getContainer(connection.containerId);
      }
    }
  }

  async startConnection(connection: MilvusConnection, startContext: LifecycleContext): Promise<void> {
    const container = this.getContainer(connection);
    if (container) {
      await container.start();
      return connection.start(startContext);
    }
  }

  async stopConnection(connection: MilvusConnection, stopContext: LifecycleContext): Promise<void> {
    const container = this.getContainer(connection);
    if (container) {
      await container.stop();
      return connection.stop(stopContext);
    }
  }

  async deleteConnection(connection: MilvusConnection, _logger?: Logger): Promise<void> {
    const container = this.getContainer(connection);
    if (container) {
      await container.remove();
    }
    const entry = this.#connections.get(`${connection.path}::${connection.containerId}`);
    if (entry !== undefined) {
      entry.disposable.dispose();
      this.#connections.delete(`${connection.path}::${connection.containerId}`);
      const path = join(this.extensionContext.storagePath, entry.connection.name);
      await rm(path, { recursive: true, force: true });
    }
  }

  dispose(): void {
    this.#connections.forEach((entry, _key) => entry.disposable.dispose());
    this.#connections.clear();
  }

  async discoverExistingContainers(): Promise<void> {
    try {
      const existingContainers = Array.from(this.#connections.keys());
      for (const endpoint of this.containerExtensionAPI.getEndpoints()) {
        const containers = await endpoint.dockerode.listContainers({ all: true });
        for (const container of containers) {
          const milvusName = container.Labels?.['io.kortex.milvus.name'];
          const milvusPort = container.Labels?.['io.kortex.milvus.port'];

          if (milvusName && milvusPort) {
            this.registerConnection({
              path: endpoint.path,
              id: container.Id,
              name: milvusName,
              port: parseInt(milvusPort, 10),
              running: container.State === 'running',
            });
            existingContainers.splice(existingContainers.indexOf(`${endpoint.path}::${container.Id}`), 1);
          }
        }
      }
      for (const key of existingContainers) {
        const entry = this.#connections.get(key);
        if (entry !== undefined) {
          entry.disposable.dispose();
          this.#connections.delete(key);
        }
      }
    } catch (err: unknown) {
      console.error(`Failed to discover containers: ${err}`);
    }
  }

  async init(): Promise<void> {
    await this.discoverExistingContainers();
    this.containerExtensionAPI.onContainersChanged(this.discoverExistingContainers.bind(this));
    this.containerExtensionAPI.onEndpointsChanged(this.discoverExistingContainers.bind(this));

    // Create the RAG connection factory
    const ragFactory: RagProviderConnectionFactory = {
      creationDisplayName: 'Milvus Vector Database',
      create: this.factory.bind(this),
    };

    this.extensionContext.subscriptions.push(this.milvusProvider.setRagProviderConnectionFactory(ragFactory));
  }

  private async checkMilvusImage(dockerode: Dockerode, logger?: Logger): Promise<boolean> {
    logger?.log(`Checking if Milvus image ${MILVUS_IMAGE} is available...`);
    try {
      await dockerode.getImage(MILVUS_IMAGE).inspect();
      return true;
    } catch (err) {
      return false;
    }
  }

  private async pullMilvusImage(dockerode: Dockerode, logger?: Logger): Promise<void> {
    logger?.log(`Pulling Milvus image ${MILVUS_IMAGE}...`);
    const promise = Promise.withResolvers<void>();
    try {
      const stream = await dockerode.pull(MILVUS_IMAGE);
      const onFinished = (err: Error | null): void => {
        if (err) {
          promise.reject(err);
        }
        promise.resolve();
      };
      dockerode.modem.followProgress(stream, onFinished, (): void => {});
    } catch (err: unknown) {
      console.error(`Failed to pull Milvus image ${MILVUS_IMAGE}: ${err}`);
    }
    return promise.promise;
  }

  async factory(params: { [key: string]: unknown }, logger?: Logger): Promise<void> {
    logger?.log('Creating Milvus RAG connection...');

    const name = params['milvus.name'] as string;
    if (!name) {
      throw new Error('Name parameter is required');
    }

    logger?.log(`Connection name: ${name}`);

    // Create storage folder for this Milvus instance
    const storagePath = join(this.extensionContext.storagePath, name);
    logger?.log(`Storage path: ${storagePath}`);

    // Ensure storage directory exists
    await mkdir(storagePath, { recursive: true });
    const { etcdConfigFile, userConfigFile } = await createConfigFile(storagePath);
    const containerName = `milvus-${name}`;

    logger?.log('Using podman CLI to create container...');

    // Check if podman is available
    const containerConnection = this.containerExtensionAPI.getEndpoints()[0];
    if (!containerConnection) {
      throw new Error('No container endpoint available');
    }
    const dockerode = containerConnection.dockerode;
    const isImageAvailable = await this.checkMilvusImage(dockerode, logger);
    if (!isImageAvailable) {
      await this.pullMilvusImage(dockerode, logger);
    }

    const port = getRandomPort();
    // Create and start the container using podman CLI
    logger?.log('Creating and starting container...');
    const createContainerOptions: Dockerode.ContainerCreateOptions = {
      name: containerName,
      Image: MILVUS_IMAGE,
      Cmd: ['milvus', 'run', 'standalone'],
      Env: [
        'ETCD_USE_EMBED=true',
        'ETCD_DATA_DIR=/var/lib/milvus/etcd',
        'ETCD_CONFIG_PATH=/milvus/configs/embedEtcd.yaml',
        'COMMON_STORAGETYPE=local',
        'DEPLOY_MODE=STANDALONE',
      ],
      HostConfig: {
        PortBindings: {
          [`${MILVUS_PORT}/tcp`]: [{ HostPort: `${port}` }],
        },
        Binds: [
          `${storagePath}:/var/lib/milvus:Z`,
          `${etcdConfigFile}:/milvus/configs/embedEtcd.yaml:Z`,
          `${userConfigFile}:/milvus/configs/user.yaml:Z`,
        ],
      },
      Labels: { 'io.kortex.milvus.name': name, 'io.kortex.milvus.port': port.toString() },
    };
    const container = await dockerode.createContainer(createContainerOptions);
    await container.start();
    logger?.log(`Container created and started with ID: ${container.id}`);
    this.registerConnection({ path: containerConnection.path, id: container.id, name, port, running: true });

    logger?.log(`Milvus RAG connection '${name}' created successfully`);
  }
}
