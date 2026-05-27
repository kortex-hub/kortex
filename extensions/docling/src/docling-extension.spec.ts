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

import { openAsBlob } from 'node:fs';
import { copyFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

import type { ChunkProvider, Extension, ExtensionContext, Provider } from '@openkaiden/api';
import { extensions, process as apiProcess, provider as providerApi, rag, Uri } from '@openkaiden/api';
import type { ContainerExtensionAPI } from '@openkaiden/container-extension-api';
import type Dockerode from 'dockerode';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { InversifyBinding } from '/@/inject/inversify-binding';
import type { ConnectionManager } from '/@/manager/connection-manager';

import { DoclingExtension } from './docling-extension';
import { generateRandomFolderName } from './util';

vi.mock(import('node:fs'));
vi.mock(import('node:fs/promises'));
vi.mock(import('./util'));
vi.mock(import('/@/inject/inversify-binding'));
vi.mock(import('/@/manager/connection-manager'));

describe('DoclingExtension', () => {
  let extensionContext: ExtensionContext;
  let doclingExtension: DoclingExtension;
  let containerExtensionAPI: ContainerExtensionAPI;
  let dockerodeMock: Dockerode;
  let containerMock: Dockerode.Container;
  let imageMock: Dockerode.Image;
  let providerMock: Provider;
  let connectionManagerMock: ConnectionManager;
  let inversifyBindingMock: InversifyBinding;

  const originalConsoleError = console.error;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.clearAllMocks();

    console.error = vi.fn();

    extensionContext = {
      subscriptions: [],
      storagePath: '/test/storage',
    } as unknown as ExtensionContext;

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
        followProgress: vi.fn((stream, onFinished) => onFinished(null)),
      },
    } as unknown as Dockerode;

    providerMock = {
      setChunkProviderConnectionFactory: vi.fn().mockReturnValue({ dispose: vi.fn() }),
      registerChunkProviderConnection: vi.fn().mockReturnValue({ dispose: vi.fn() }),
      dispose: vi.fn(),
    } as unknown as Provider;

    vi.mocked(providerApi.createProvider).mockReturnValue(providerMock);

    containerExtensionAPI = {
      getEndpoints: vi.fn().mockReturnValue([{ dockerode: dockerodeMock, path: '/test/endpoint' }]),
      onContainersChanged: vi.fn().mockReturnValue({ dispose: vi.fn() }),
      onEndpointsChanged: vi.fn().mockReturnValue({ dispose: vi.fn() }),
    } as unknown as ContainerExtensionAPI;

    const extensionData = {
      exports: containerExtensionAPI,
    } as unknown as Extension<ContainerExtensionAPI>;

    vi.mocked(extensions.getExtension).mockReturnValue(extensionData);

    connectionManagerMock = {
      init: vi.fn().mockResolvedValue(undefined),
      dispose: vi.fn().mockResolvedValue(undefined),
    } as unknown as ConnectionManager;

    inversifyBindingMock = {
      initBindings: vi.fn().mockResolvedValue({
        get: vi.fn().mockReturnValue(connectionManagerMock),
      }),
      dispose: vi.fn().mockResolvedValue(undefined),
    } as unknown as InversifyBinding;

    vi.mocked(InversifyBinding).mockImplementation(function () {
      return inversifyBindingMock;
    } as unknown as typeof InversifyBinding);

    doclingExtension = new DoclingExtension(extensionContext);

    global.fetch = vi.fn();

    vi.mocked(mkdir).mockResolvedValue(undefined);
    vi.mocked(rm).mockResolvedValue(undefined);
    vi.mocked(copyFile).mockResolvedValue(undefined);

    vi.mocked(generateRandomFolderName).mockReturnValue('randomfolder');
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  describe('activate', () => {
    test('should create provider and initialize InversifyBinding', async () => {
      vi.mocked(dockerodeMock.listContainers).mockResolvedValue([
        {
          Id: 'existing-container-id',
          Labels: {
            'ai.openkaiden.docling.port': '8080',
          },
          State: 'running',
        },
      ] as unknown as Dockerode.ContainerInfo[]);

      await doclingExtension.activate();

      expect(providerApi.createProvider).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'docling',
          name: 'Docling',
          status: 'ready',
        }),
      );
      expect(InversifyBinding).toHaveBeenCalledWith(providerMock, containerExtensionAPI, extensionContext);
      expect(inversifyBindingMock.initBindings).toHaveBeenCalled();
    });

    test('should initialize ConnectionManager', async () => {
      vi.mocked(dockerodeMock.listContainers).mockResolvedValue([
        {
          Id: 'existing-container-id',
          Labels: { 'ai.openkaiden.docling.port': '8080' },
          State: 'running',
        },
      ] as unknown as Dockerode.ContainerInfo[]);

      await doclingExtension.activate();

      expect(connectionManagerMock.init).toHaveBeenCalled();
    });

    test('should activate successfully with existing container', async () => {
      vi.mocked(dockerodeMock.listContainers).mockResolvedValue([
        {
          Id: 'existing-container-id',
          Labels: {
            'ai.openkaiden.docling.port': '8080',
          },
          Status: 'running',
          State: 'running',
        },
      ] as unknown as Dockerode.ContainerInfo[]);
      const spy = vi.spyOn(extensionContext.subscriptions, 'push');

      await doclingExtension.activate();

      expect(rag.registerChunkProvider).toHaveBeenCalled();
      expect(spy).toHaveBeenCalled();
    });

    test('should activate successfully by launching new container', async () => {
      vi.mocked(dockerodeMock.listContainers).mockResolvedValue([]);

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
      } as Response);

      await doclingExtension.activate();

      expect(mkdir).toHaveBeenCalledWith(join('/test', 'storage', 'docling-workspace'), { recursive: true });
      expect(dockerodeMock.createContainer).toHaveBeenCalled();
      expect(containerMock.start).toHaveBeenCalled();
      expect(rag.registerChunkProvider).toHaveBeenCalled();
    });

    test('should fail when container extension is not installed', async () => {
      vi.mocked(extensions.getExtension).mockReturnValue(undefined);

      await expect(doclingExtension.activate()).rejects.toThrow(
        'Mandatory extension kaiden.container is not installed',
      );
    });

    test('should fail when container extension exports are missing', async () => {
      const extensionData = { exports: undefined } as unknown as Extension<ContainerExtensionAPI>;
      vi.mocked(extensions.getExtension).mockReturnValue(extensionData);

      await expect(doclingExtension.activate()).rejects.toThrow(
        'Missing exports of API in container extension kaiden.container',
      );
    });

    test('should fail when container launch fails', async () => {
      vi.mocked(dockerodeMock.listContainers).mockResolvedValue([]);

      vi.mocked(dockerodeMock.createContainer).mockRejectedValue(new Error('Container creation failed'));

      await expect(doclingExtension.activate()).rejects.toThrow('Container creation failed');
    });

    test('should restart stopped container', async () => {
      vi.mocked(dockerodeMock.listContainers).mockResolvedValue([
        {
          Id: 'stopped-container-id',
          Labels: {
            'ai.openkaiden.docling.port': '8080',
            'ai.openkaiden.docling.folder': '/test/workspace',
          },
          Status: 'exited',
          State: 'exited',
        },
      ] as unknown as Dockerode.ContainerInfo[]);

      await doclingExtension.activate();

      expect(containerMock.start).toHaveBeenCalled();
      expect(rag.registerChunkProvider).toHaveBeenCalled();
    });
  });

  describe('deactivate', () => {
    beforeEach(async () => {
      vi.mocked(dockerodeMock.listContainers).mockResolvedValue([
        {
          Id: 'test-container-id',
          Labels: {
            'ai.openkaiden.docling.port': '8080',
            'ai.openkaiden.docling.folder': '/test/workspace',
          },
          Status: 'running',
          State: 'running',
        },
      ] as unknown as Dockerode.ContainerInfo[]);

      await doclingExtension.activate();
    });

    test('should stop container', async () => {
      await doclingExtension.deactivate();

      expect(containerMock.stop).toHaveBeenCalled();
    });

    test('should dispose ConnectionManager and InversifyBinding on deactivate', async () => {
      await doclingExtension.deactivate();

      expect(connectionManagerMock.dispose).toHaveBeenCalled();
      expect(inversifyBindingMock.dispose).toHaveBeenCalled();
    });

    test('should handle errors when stopping container', async () => {
      await doclingExtension.deactivate();

      await vi.waitFor(() => expect(containerMock.stop).toHaveBeenCalled());
    });

    test('should handle errors when cleaning workspace', async () => {
      vi.mocked(rm).mockRejectedValue(new Error('Cleanup failed'));

      await doclingExtension.deactivate();

      expect(console.error).toHaveBeenCalled();
    });

    test('should do nothing for legacy container if container info is not set', async () => {
      const freshExtension = new DoclingExtension(extensionContext);
      await freshExtension.deactivate();

      expect(apiProcess.exec).not.toHaveBeenCalled();
      expect(rm).not.toHaveBeenCalled();
    });
  });

  describe('convertDocument', () => {
    beforeEach(async () => {
      vi.mocked(dockerodeMock.listContainers).mockResolvedValue([
        {
          Id: 'test-container-id',
          Labels: {
            'ai.openkaiden.docling.port': '8080',
            'ai.openkaiden.docling.folder': '/test/workspace',
          },
          Status: 'running',
          State: 'running',
        },
      ] as unknown as Dockerode.ContainerInfo[]);
      vi.mocked(openAsBlob).mockResolvedValue(new Blob(['data']));

      await doclingExtension.activate();
    });

    test('should convert document successfully', async () => {
      vi.mocked(Uri.file).mockReturnValue({ fsPath: '/path/to/document.pdf' } as unknown as Uri);
      const docUri = Uri.file('/path/to/document.pdf');

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          chunks: [{ text: 'first chunk' }, { text: 'second chunk' }, { text: 'third chunk' }],
        }),
      } as unknown as Response);

      const chunks = await doclingExtension.convertDocument(docUri);

      expect(chunks).toHaveLength(3);
      expect(global.fetch).toHaveBeenCalled();
    });

    test('should throw error if container is not running', async () => {
      const freshExtension = new DoclingExtension(extensionContext);
      const docUri = Uri.file('/path/to/document.pdf');

      await expect(freshExtension.convertDocument(docUri)).rejects.toThrow('Docling container is not running');
    });

    test('should throw error if conversion fails', async () => {
      vi.mocked(Uri.file).mockReturnValue({ fsPath: '/path/to/document.pdf' } as unknown as Uri);
      const docUri = Uri.file('/path/to/document.pdf');

      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 500,
        json: vi.fn().mockResolvedValue('Internal server error'),
      } as unknown as Response);

      await expect(doclingExtension.convertDocument(docUri)).rejects.toThrow('Conversion failed');
    });
  });

  describe('discoverExistingContainer', () => {
    test('should discover running container', async () => {
      vi.mocked(dockerodeMock.listContainers).mockResolvedValue([
        {
          Id: 'existing-container-id',
          Labels: {
            'ai.openkaiden.docling.port': '8080',
          },
          Status: 'running',
          State: 'running',
        },
      ] as unknown as Dockerode.ContainerInfo[]);

      const result = await doclingExtension.discoverExistingContainer(containerExtensionAPI);

      expect(result).toMatchObject({
        containerId: 'existing-container-id',
        port: 8080,
      });
    });

    test('should skip containers with name label (named connections)', async () => {
      vi.mocked(dockerodeMock.listContainers).mockResolvedValue([
        {
          Id: 'named-container-id',
          Labels: {
            'ai.openkaiden.docling.port': '9090',
            'ai.openkaiden.docling.name': 'my-connection',
          },
          Status: 'running',
          State: 'running',
        },
      ] as unknown as Dockerode.ContainerInfo[]);

      const result = await doclingExtension.discoverExistingContainer(containerExtensionAPI);

      expect(result).toBeUndefined();
    });

    test('should restart stopped container', async () => {
      vi.mocked(dockerodeMock.listContainers).mockResolvedValue([
        {
          Id: 'stopped-container-id',
          Labels: {
            'ai.openkaiden.docling.port': '8080',
            'ai.openkaiden.docling.folder': '/test/workspace',
          },
          Status: 'exited',
          State: 'exited',
        },
      ] as unknown as Dockerode.ContainerInfo[]);

      const result = await doclingExtension.discoverExistingContainer(containerExtensionAPI);

      expect(containerMock.start).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    test('should return undefined when no container found', async () => {
      vi.mocked(dockerodeMock.listContainers).mockResolvedValue([]);

      const result = await doclingExtension.discoverExistingContainer(containerExtensionAPI);

      expect(result).toBeUndefined();
    });

    test('should handle errors when listing containers', async () => {
      vi.mocked(dockerodeMock.listContainers).mockRejectedValue(new Error('List failed'));

      const result = await doclingExtension.discoverExistingContainer(containerExtensionAPI);

      expect(result).toBeUndefined();
      expect(console.error).toHaveBeenCalled();
    });

    test('should handle errors when getting endpoints', async () => {
      vi.mocked(containerExtensionAPI.getEndpoints).mockImplementation(() => {
        throw new Error('Failed to get endpoints');
      });

      const result = await doclingExtension.discoverExistingContainer(containerExtensionAPI);

      expect(result).toBeUndefined();
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('launchContainer', () => {
    test('should launch container successfully when image exists', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
      } as Response);

      const result = await doclingExtension.launchContainer(containerExtensionAPI);

      expect(imageMock.inspect).toHaveBeenCalled();
      expect(dockerodeMock.createContainer).toHaveBeenCalled();
      expect(containerMock.start).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result.containerId).toBe('test-container-id');
    });

    test('should set UVICORN_WORKERS=1 to avoid multi-worker task routing issues', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
      } as Response);

      await doclingExtension.launchContainer(containerExtensionAPI);

      expect(dockerodeMock.createContainer).toHaveBeenCalledWith(
        expect.objectContaining({
          Env: expect.arrayContaining(['UVICORN_WORKERS=1']),
        }),
      );
    });

    test('should pull image if not available', async () => {
      vi.mocked(imageMock.inspect).mockRejectedValue(new Error('Image not found'));

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
      } as Response);

      const result = await doclingExtension.launchContainer(containerExtensionAPI);

      expect(dockerodeMock.pull).toHaveBeenCalled();
      expect(dockerodeMock.createContainer).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    test('should wait for health check to pass', async () => {
      let healthCheckCount = 0;
      vi.mocked(global.fetch).mockImplementation(async () => {
        healthCheckCount++;
        if (healthCheckCount < 3) {
          throw new Error('Not ready yet');
        }
        return { ok: true } as Response;
      });

      const result = await doclingExtension.launchContainer(containerExtensionAPI);

      expect(result).toBeDefined();
      expect(healthCheckCount).toBe(3);
    });

    test('should throw error when no endpoints available', async () => {
      vi.mocked(containerExtensionAPI.getEndpoints).mockReturnValue([]);

      await expect(doclingExtension.launchContainer(containerExtensionAPI)).rejects.toThrow(
        'No container engine endpoint found',
      );
    });

    test('should throw error when container creation fails', async () => {
      vi.mocked(dockerodeMock.createContainer).mockRejectedValue(new Error('Creation failed'));

      await expect(doclingExtension.launchContainer(containerExtensionAPI)).rejects.toThrow('Creation failed');
    });
  });

  describe('chunk provider', () => {
    test('should register chunk provider with correct implementation', async () => {
      let registeredProvider: ChunkProvider;
      vi.mocked(rag.registerChunkProvider).mockImplementation(provider => {
        registeredProvider = provider;
        return { dispose: vi.fn() };
      });

      vi.mocked(dockerodeMock.listContainers).mockResolvedValue([
        {
          Id: 'test-container-id',
          Labels: {
            'ai.openkaiden.docling.port': '8080',
          },
          Status: 'running',
          State: 'running',
        },
      ] as unknown as Dockerode.ContainerInfo[]);

      await doclingExtension.activate();

      expect(registeredProvider!).toBeDefined();
      expect(registeredProvider!.name).toBe('docling');
      expect(typeof registeredProvider!.chunk).toBe('function');
    });

    test('should handle chunk provider errors', async () => {
      vi.mocked(Uri.file).mockReturnValue({ fsPath: '/path/to/document.pdf' } as unknown as Uri);
      let registeredProvider: ChunkProvider;
      vi.mocked(rag.registerChunkProvider).mockImplementation(provider => {
        registeredProvider = provider;
        return { dispose: vi.fn() };
      });

      vi.mocked(dockerodeMock.listContainers).mockResolvedValue([
        {
          Id: 'test-container-id',
          Labels: {
            'ai.openkaiden.docling.port': '8080',
          },
          Status: 'running',
          State: 'running',
        },
      ] as unknown as Dockerode.ContainerInfo[]);
      vi.mocked(openAsBlob).mockResolvedValue(new Blob(['data']));

      await doclingExtension.activate();

      const docUri = Uri.file('/path/to/document.pdf');
      vi.mocked(global.fetch).mockRejectedValue(new Error('Conversion error'));

      await expect(registeredProvider!.chunk(docUri)).rejects.toThrow('Conversion error');

      expect(console.error).toHaveBeenCalledWith('Failed to convert document:', expect.any(Error));
    });
  });
});
