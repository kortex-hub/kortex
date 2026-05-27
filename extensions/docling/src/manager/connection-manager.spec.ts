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

import { openAsBlob } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type {
  ChunkProviderConnection,
  Disposable,
  ExtensionContext,
  LifecycleContext,
  Logger,
  Provider,
} from '@openkaiden/api';
import { Uri } from '@openkaiden/api';
import type { ContainerExtensionAPI, EndpointConnection } from '@openkaiden/container-extension-api';
import type Dockerode from 'dockerode';
import { Container } from 'inversify';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { ContainerExtensionAPISymbol, DoclingProviderSymbol, ExtensionContextSymbol } from '/@/inject/symbol';

import { ConnectionManager } from './connection-manager';

vi.mock(import('node:fs'));
vi.mock(import('node:fs/promises'));

let connectionManager: ConnectionManager;
let containerExtensionAPIMock: ContainerExtensionAPI;
let doclingProviderMock: Provider;
let containerMock: Dockerode.Container;
let imageMock: Dockerode.Image;
let dockerodeMock: Dockerode;
let setChunkFactoryDisposable: Disposable;
let registerChunkConnectionDisposable: Disposable;

const extensionContextMock = {
  storagePath: '/test/storage',
  subscriptions: [] as Disposable[],
} as unknown as ExtensionContext;

beforeEach(async () => {
  vi.resetAllMocks();

  (extensionContextMock as { subscriptions: Disposable[] }).subscriptions = [];

  vi.mocked(mkdir).mockResolvedValue(undefined);
  vi.mocked(rm).mockResolvedValue(undefined);
  vi.mocked(writeFile).mockResolvedValue(undefined);

  containerMock = {
    id: 'test-container-id',
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
  } as unknown as Dockerode.Container;

  imageMock = {
    inspect: vi.fn().mockResolvedValue({}),
  } as unknown as Dockerode.Image;

  dockerodeMock = {
    listContainers: vi.fn().mockResolvedValue([]),
    createContainer: vi.fn().mockResolvedValue(containerMock),
    getContainer: vi.fn().mockReturnValue(containerMock),
    getImage: vi.fn().mockReturnValue(imageMock),
    pull: vi.fn().mockResolvedValue({}),
    modem: {
      followProgress: vi.fn((_stream: unknown, onFinished: (err: Error | null) => void) => onFinished(null)),
    },
  } as unknown as Dockerode;

  setChunkFactoryDisposable = { dispose: vi.fn() };
  registerChunkConnectionDisposable = { dispose: vi.fn() };

  doclingProviderMock = {
    setChunkProviderConnectionFactory: vi.fn().mockReturnValue(setChunkFactoryDisposable),
    registerChunkProviderConnection: vi.fn().mockReturnValue(registerChunkConnectionDisposable),
    dispose: vi.fn(),
  } as unknown as Provider;

  containerExtensionAPIMock = {
    getEndpoints: vi
      .fn()
      .mockReturnValue([{ dockerode: dockerodeMock, path: '/test/endpoint' } as unknown as EndpointConnection]),
    onContainersChanged: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    onEndpointsChanged: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  } as unknown as ContainerExtensionAPI;

  global.fetch = vi.fn();

  const container = new Container();
  container.bind(ConnectionManager).toSelf();
  container.bind(ExtensionContextSymbol).toConstantValue(extensionContextMock);
  container.bind(ContainerExtensionAPISymbol).toConstantValue(containerExtensionAPIMock);
  container.bind(DoclingProviderSymbol).toConstantValue(doclingProviderMock);

  connectionManager = await container.getAsync<ConnectionManager>(ConnectionManager);
});

describe('ConnectionManager', () => {
  describe('init', () => {
    test('should discover existing connections and setup listeners', async () => {
      await connectionManager.init();

      expect(containerExtensionAPIMock.onContainersChanged).toHaveBeenCalled();
      expect(containerExtensionAPIMock.onEndpointsChanged).toHaveBeenCalled();
    });

    test('should register chunk provider connection factory', async () => {
      await connectionManager.init();

      expect(doclingProviderMock.setChunkProviderConnectionFactory).toHaveBeenCalledWith(
        expect.objectContaining({
          creationDisplayName: 'Docling Chunk Provider',
          create: expect.any(Function),
        }),
      );
    });

    test('should push factory disposable to subscriptions', async () => {
      await connectionManager.init();

      expect(extensionContextMock.subscriptions).toContain(setChunkFactoryDisposable);
    });
  });

  describe('dispose', async () => {
    test('should clean up all connections', async () => {
      await connectionManager.registerConnection({
        path: '/test/endpoint',
        containerId: 'container1',
        name: 'test-1',
        port: 9090,
        running: true,
      });

      await connectionManager.registerConnection({
        path: '/test/endpoint',
        containerId: 'container2',
        name: 'test-2',
        port: 9091,
        running: true,
      });

      connectionManager.dispose();

      expect(registerChunkConnectionDisposable.dispose).toHaveBeenCalledTimes(2);
    });

    test('should not stop already-stopped containers', async () => {
      await connectionManager.registerConnection({
        path: '/test/endpoint',
        containerId: 'container1',
        name: 'test-1',
        port: 9090,
        running: false,
      });

      connectionManager.dispose();

      expect(containerMock.stop).not.toHaveBeenCalled();
      expect(registerChunkConnectionDisposable.dispose).toHaveBeenCalled();
    });
  });

  describe('factory', () => {
    test('should throw error when name parameter is missing', async () => {
      await expect(connectionManager.factory({})).rejects.toThrow('Name parameter is required');
    });

    test('should throw error when name is empty', async () => {
      await expect(connectionManager.factory({ 'docling.name': '' })).rejects.toThrow('Name parameter is required');
    });

    test('should create container with correct labels', async () => {
      vi.mocked(global.fetch).mockResolvedValue({ ok: true } as Response);

      await connectionManager.factory({ 'docling.name': 'my-chunker' });

      expect(dockerodeMock.createContainer).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'docling-my-chunker',
          Labels: {
            'ai.openkaiden.docling.name': 'my-chunker',
            'ai.openkaiden.docling.port': expect.any(String),
          },
          Image: 'quay.io/docling-project/docling-serve:v1.9.0',
          Env: ['UVICORN_WORKERS=1'],
        }),
      );
    });

    test('should create workspace folder for connection', async () => {
      vi.mocked(global.fetch).mockResolvedValue({ ok: true } as Response);

      await connectionManager.factory({ 'docling.name': 'my-chunker' });

      expect(mkdir).toHaveBeenCalledWith(join('/test', 'storage', 'my-chunker'), { recursive: true });
    });

    test('should register connection after container starts', async () => {
      vi.mocked(global.fetch).mockResolvedValue({ ok: true } as Response);

      await connectionManager.factory({ 'docling.name': 'my-chunker' });

      expect(doclingProviderMock.registerChunkProviderConnection).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'docling-my-chunker',
          name: 'my-chunker',
          chunk: expect.any(Function),
          status: expect.any(Function),
          lifecycle: expect.objectContaining({
            start: expect.any(Function),
            stop: expect.any(Function),
            delete: expect.any(Function),
          }),
        }),
      );
    });

    test('should pull image if not available', async () => {
      vi.mocked(imageMock.inspect).mockRejectedValue(new Error('Not found'));
      vi.mocked(global.fetch).mockResolvedValue({ ok: true } as Response);

      await connectionManager.factory({ 'docling.name': 'my-chunker' });

      expect(dockerodeMock.pull).toHaveBeenCalled();
    });

    test('should throw when health check fails', async () => {
      vi.useFakeTimers();
      vi.mocked(global.fetch).mockRejectedValue(new Error('Not ready'));

      const promise = connectionManager.factory({ 'docling.name': 'my-chunker' });
      const expectation = expect(promise).rejects.toThrow('Failed to start Docling container');

      for (let i = 0; i < 60; i++) {
        await vi.advanceTimersByTimeAsync(1000);
      }

      await expectation;
      vi.useRealTimers();
    });

    test('should throw when no container endpoint is available', async () => {
      vi.mocked(containerExtensionAPIMock.getEndpoints).mockReturnValue([]);

      await expect(connectionManager.factory({ 'docling.name': 'my-chunker' })).rejects.toThrow(
        'No container endpoint available',
      );
    });

    test('should use logger when provided', async () => {
      vi.mocked(global.fetch).mockResolvedValue({ ok: true } as Response);
      const logger = { log: vi.fn(), error: vi.fn(), warn: vi.fn() } as unknown as Logger;

      await connectionManager.factory({ 'docling.name': 'my-chunker' }, logger);

      expect(logger.log).toHaveBeenCalledWith('Creating Docling chunk provider connection...');
      expect(logger.log).toHaveBeenCalledWith('Connection name: my-chunker');
      expect(logger.log).toHaveBeenCalledWith(expect.stringContaining('created successfully'));
    });
  });

  describe('registerConnection', () => {
    test('should register a new connection', async () => {
      await connectionManager.registerConnection({
        path: '/test/endpoint',
        containerId: 'conn-container-id',
        name: 'test-conn',
        port: 9090,
        running: true,
      });

      expect(doclingProviderMock.registerChunkProviderConnection).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'docling-test-conn',
          name: 'test-conn',
        }),
      );
    });

    test('should update status for existing connection', async () => {
      await connectionManager.registerConnection({
        path: '/test/endpoint',
        containerId: 'conn-container-id',
        name: 'test-conn',
        port: 9090,
        running: true,
      });

      vi.mocked(doclingProviderMock.registerChunkProviderConnection).mockClear();

      await connectionManager.registerConnection({
        path: '/test/endpoint',
        containerId: 'conn-container-id',
        name: 'test-conn',
        port: 9090,
        running: false,
      });

      expect(doclingProviderMock.registerChunkProviderConnection).not.toHaveBeenCalled();
    });

    test('should set connection status based on running state', async () => {
      let registeredConnection: ChunkProviderConnection;
      vi.mocked(doclingProviderMock.registerChunkProviderConnection).mockImplementation(conn => {
        registeredConnection = conn;
        return { dispose: vi.fn() };
      });

      await connectionManager.registerConnection({
        path: '/test/endpoint',
        containerId: 'conn-container-id',
        name: 'test-conn',
        port: 9090,
        running: false,
      });

      expect(registeredConnection!.status()).toBe('stopped');
    });
  });

  describe('connection lifecycle', () => {
    let registeredConnection: ChunkProviderConnection;

    beforeEach(async () => {
      vi.mocked(doclingProviderMock.registerChunkProviderConnection).mockImplementation(conn => {
        registeredConnection = conn;
        return registerChunkConnectionDisposable;
      });

      await connectionManager.registerConnection({
        path: '/test/endpoint',
        containerId: 'lifecycle-container-id',
        name: 'lifecycle-test',
        port: 9090,
        running: true,
      });
    });

    test('should start container and update status', async () => {
      await registeredConnection.lifecycle!.stop!({} as LifecycleContext);
      expect(registeredConnection.status()).toBe('stopped');

      await registeredConnection.lifecycle!.start!({} as LifecycleContext);
      expect(containerMock.start).toHaveBeenCalled();
      expect(registeredConnection.status()).toBe('started');
    });

    test('should stop container and update status', async () => {
      await registeredConnection.lifecycle!.stop!({} as LifecycleContext);
      expect(containerMock.stop).toHaveBeenCalled();
      expect(registeredConnection.status()).toBe('stopped');
    });

    test('should delete container and clean up', async () => {
      await registeredConnection.lifecycle!.delete!();

      expect(containerMock.remove).toHaveBeenCalled();
      expect(registerChunkConnectionDisposable.dispose).toHaveBeenCalled();
      expect(rm).toHaveBeenCalledWith(join('/test', 'storage', 'lifecycle-test'), {
        recursive: true,
        force: true,
      });
    });
  });

  describe('discoverExistingConnections', () => {
    test('should discover containers with name and port labels', async () => {
      vi.mocked(dockerodeMock.listContainers).mockResolvedValue([
        {
          Id: 'named-container-id',
          Labels: {
            'ai.openkaiden.docling.name': 'discovered-conn',
            'ai.openkaiden.docling.port': '9090',
          },
          State: 'running',
        },
      ] as unknown as Dockerode.ContainerInfo[]);

      await connectionManager.discoverExistingConnections();

      expect(doclingProviderMock.registerChunkProviderConnection).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'docling-discovered-conn',
          name: 'discovered-conn',
        }),
      );
    });

    test('should ignore containers without name label', async () => {
      vi.mocked(dockerodeMock.listContainers).mockResolvedValue([
        {
          Id: 'unnamed-container-id',
          Labels: {
            'ai.openkaiden.docling.port': '8080',
          },
          State: 'running',
        },
      ] as unknown as Dockerode.ContainerInfo[]);

      await connectionManager.discoverExistingConnections();

      expect(doclingProviderMock.registerChunkProviderConnection).not.toHaveBeenCalled();
    });

    test('should remove stale connections', async () => {
      vi.mocked(doclingProviderMock.registerChunkProviderConnection).mockReturnValue(registerChunkConnectionDisposable);

      vi.mocked(dockerodeMock.listContainers).mockResolvedValue([
        {
          Id: 'named-container-id',
          Labels: {
            'ai.openkaiden.docling.name': 'stale-conn',
            'ai.openkaiden.docling.port': '9090',
          },
          State: 'running',
        },
      ] as unknown as Dockerode.ContainerInfo[]);

      await connectionManager.discoverExistingConnections();

      vi.mocked(dockerodeMock.listContainers).mockResolvedValue([]);

      await connectionManager.discoverExistingConnections();

      expect(registerChunkConnectionDisposable.dispose).toHaveBeenCalled();
    });

    test('should handle discovery errors gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.mocked(dockerodeMock.listContainers).mockRejectedValue(new Error('Discovery failed'));

      await connectionManager.discoverExistingConnections();

      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to discover connections'));
    });
  });

  describe('convertDocumentForConnection', () => {
    test('should convert document via connection', async () => {
      let registeredConnection: ChunkProviderConnection;
      vi.mocked(doclingProviderMock.registerChunkProviderConnection).mockImplementation(conn => {
        registeredConnection = conn;
        return { dispose: vi.fn() };
      });

      await connectionManager.registerConnection({
        path: '/test/endpoint',
        containerId: 'chunk-container-id',
        name: 'chunk-test',
        port: 7070,
        running: true,
      });

      vi.mocked(Uri.file).mockReturnValue({ fsPath: '/path/to/document.pdf' } as unknown as Uri);
      const docUri = Uri.file('/path/to/document.pdf');
      vi.mocked(openAsBlob).mockResolvedValue(new Blob(['data']));

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          chunks: [{ text: 'chunk1' }, { text: 'chunk2' }],
        }),
      } as unknown as Response);

      const chunks = await registeredConnection!.chunk(docUri);

      expect(chunks).toHaveLength(2);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:7070/v1/chunk/hierarchical/file',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    test('should throw when connection is stopped', async () => {
      let registeredConnection: ChunkProviderConnection;
      vi.mocked(doclingProviderMock.registerChunkProviderConnection).mockImplementation(conn => {
        registeredConnection = conn;
        return { dispose: vi.fn() };
      });

      await connectionManager.registerConnection({
        path: '/test/endpoint',
        containerId: 'stopped-chunk-container',
        name: 'stopped-test',
        port: 7070,
        running: false,
      });

      vi.mocked(Uri.file).mockReturnValue({ fsPath: '/path/to/doc.pdf' } as unknown as Uri);
      const docUri = Uri.file('/path/to/doc.pdf');

      await expect(registeredConnection!.chunk(docUri)).rejects.toThrow('Docling container is not running');
    });
  });
});
