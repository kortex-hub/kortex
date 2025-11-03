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

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import * as api from '@kortex-app/api';
import type { ContainerInfo } from 'dockerode';

import { MilvusConnection } from './milvus-connection';

const MILVUS_IMAGE = 'docker.io/milvusdb/milvus:v2.6.3';
const MILVUS_PORT = 19530;
const MILVUS_METRIC_PORT = 9091;

const etcdContent = `
listen-client-urls: http://0.0.0.0:2379
advertise-client-urls: http://0.0.0.0:2379
quota-backend-bytes: 4294967296
auto-compaction-mode: revision
auto-compaction-retention: '1000'`;

async function createConfigFile(storagePath: string): Promise<{ etcdConfigFile: string; userConfigFile: string }> {
  const etcdConfigFile = join(storagePath, 'embedEtcd.yaml');
  const userConfigFile = join(storagePath, 'user.yaml');
  await writeFile(etcdConfigFile, etcdContent);
  await writeFile(userConfigFile, '');
  return { etcdConfigFile, userConfigFile };
}

function getRandomPort(): number {
  return 1024 + Math.floor(Math.random() * (65535 - 1024));
}

interface ExistingContainer {
  id: string;
  name: string;
  port: number;
  running: boolean;
}

async function discoverExistingContainers(logger?: api.Logger): Promise<ExistingContainer[]> {
  logger?.log('Discovering existing Milvus containers...');

  try {
    // List all containers (running and stopped) with Milvus labels
    const { stdout } = await api.process.exec('podman', ['ps', '-a', '--format', 'json']);

    if (!stdout || stdout.trim() === '') {
      logger?.log('No existing Milvus containers found');
      return [];
    }

    const containers: ExistingContainer[] = [];
    const containerList = JSON.parse(stdout) as ContainerInfo[];

    for (const container of containerList) {
      const milvusName = container.Labels?.['io.kortex.milvus.name'];
      const milvusPort = container.Labels?.['io.kortex.milvus.port'];

      if (milvusName && milvusPort) {
        containers.push({
          id: container.Id,
          name: milvusName,
          port: parseInt(milvusPort, 10),
          running: container.State === 'running',
        });
        logger?.log(`Found container: ${milvusName} (with port ${milvusPort}, state: ${container.State}`);
      }
    }

    return containers;
  } catch (err: unknown) {
    logger?.error(`Failed to discover containers: ${err}`);
    return [];
  }
}

export async function activate(extensionContext: api.ExtensionContext): Promise<void> {
  console.log('Starting Milvus extension');

  // Create the Milvus provider
  const provider = api.provider.createProvider({
    id: 'milvus',
    name: 'Milvus',
    status: 'ready',
    images: {
      icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iIzQyODVGNCIvPjx0ZXh0IHg9IjUwIiB5PSI1MCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjI0IiBmaWxsPSJ3aGl0ZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk08L3RleHQ+PC9zdmc+',
    },
  });

  // Discover and register existing Milvus containers
  const existingContainers = await discoverExistingContainers();
  console.log(`Found ${existingContainers.length} existing Milvus container(s)`);

  for (const container of existingContainers) {
    console.log(`Registering existing container: ${container.name} (${container.id})`);
    const connection = new MilvusConnection(container.name, container.id, container.port, container.running);

    const disposable = provider.registerRagProviderConnection(connection);
    extensionContext.subscriptions.push(disposable);
    console.log(`Registered container '${container.name}'`);
  }

  // Create the RAG connection factory
  const ragFactory: api.RagProviderConnectionFactory = {
    creationDisplayName: 'Milvus Vector Database',

    async create(params: { [key: string]: unknown }, logger?: api.Logger): Promise<void> {
      logger?.log('Creating Milvus RAG connection...');

      const name = params['milvus.name'] as string;
      if (!name) {
        throw new Error('Name parameter is required');
      }

      logger?.log(`Connection name: ${name}`);

      // Create storage folder for this Milvus instance
      const storagePath = join(extensionContext.storagePath, name);
      logger?.log(`Storage path: ${storagePath}`);

      // Ensure storage directory exists
      await mkdir(storagePath, { recursive: true });
      const { etcdConfigFile, userConfigFile } = await createConfigFile(storagePath);
      const containerName = `milvus-${name}`;

      logger?.log('Using podman CLI to create container...');

      // Check if podman is available
      try {
        await api.process.exec('podman', ['--version']);
        logger?.log('Podman CLI is available');
      } catch (err) {
        throw new Error('Podman CLI is not available. Please install podman.');
      }

      // Pull the Milvus image
      logger?.log(`Pulling image ${MILVUS_IMAGE}...`);
      try {
        await api.process.exec('podman', ['pull', MILVUS_IMAGE]);
        logger?.log('Image pulled successfully');
      } catch (err) {
        logger?.error(`Failed to pull image: ${err}`);
        throw new Error(`Failed to pull Milvus image: ${err}`);
      }

      const port = getRandomPort();

      // Create and start the container using podman CLI
      logger?.log('Creating and starting container with podman...');
      try {
        const { stdout: containerId } = await api.process.exec('podman', [
          'run',
          '-d',
          '--name',
          containerName,
          '-v',
          `${storagePath}:/var/lib/milvus`,
          '-v',
          `${etcdConfigFile}:/milvus/configs/embedEtcd.yaml`,
          '-v',
          `${userConfigFile}:/milvus/configs/user.yaml`,
          '-e',
          'ETCD_USE_EMBED=true',
          '-e',
          'ETCD_DATA_DIR=/var/lib/milvus/etcd',
          '-e',
          'ETCD_CONFIG_PATH=/milvus/configs/embedEtcd.yaml',
          '-e',
          'COMMON_STORAGETYPE=local',
          '-e',
          'DEPLOY_MODE=STANDALONE',
          '-p',
          `${port}:${MILVUS_PORT}`,
          '-l',
          `io.kortex.milvus.name=${name}`,
          '-l',
          `io.kortex.milvus.port=${port}`,
          MILVUS_IMAGE,
          'milvus',
          'run',
          'standalone',
        ]);

        const cleanedContainerId = containerId.trim();
        logger?.log(`Container created and started with ID: ${cleanedContainerId}`);

        // Create and register the connection
        const connection = new MilvusConnection(name, cleanedContainerId, port, true);
        const disposable = provider.registerRagProviderConnection(connection);

        extensionContext.subscriptions.push(disposable);

        logger?.log(`Milvus RAG connection '${name}' created successfully`);
      } catch (err) {
        logger?.error(`Failed to create container: ${err}`);
        throw new Error(`Failed to create Milvus container: ${err}`);
      }
    },
  };

  // Register the factory
  const factoryDisposable = provider.setRagProviderConnectionFactory(ragFactory);
  extensionContext.subscriptions.push(factoryDisposable);

  // Register the provider
  extensionContext.subscriptions.push(provider);

  console.log('Milvus extension started successfully');
}

export function deactivate(): void {
  console.log('Stopping Milvus extension');
}
