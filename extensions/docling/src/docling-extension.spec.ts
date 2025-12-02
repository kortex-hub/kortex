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
import { join } from 'node:path';

import type { ChunkProvider, Extension, ExtensionContext } from '@kortex-app/api';
import { extensions, process as apiProcess, rag, Uri } from '@kortex-app/api';
import type { ContainerExtensionAPI } from '@kortex-app/container-extension-api';
import type Dockerode from 'dockerode';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { DoclingExtension } from './docling-extension';
import { generateRandomFolderName } from './util';

vi.mock(import('node:fs/promises'));
vi.mock(import('./util'));

describe('DoclingExtension', () => {
  let extensionContext: ExtensionContext;
  let doclingExtension: DoclingExtension;
  let containerExtensionAPI: ContainerExtensionAPI;
  let dockerodeMock: Dockerode;
  let containerMock: Dockerode.Container;
  let imageMock: Dockerode.Image;

  beforeEach(() => {
    vi.resetAllMocks();
    vi.clearAllMocks();

    // Mock extension context
    extensionContext = {
      subscriptions: [],
      storagePath: '/test/storage',
    } as unknown as ExtensionContext;

    // Mock container
    containerMock = {
      id: 'test-container-id',
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
    } as unknown as Dockerode.Container;

    // Mock image
    imageMock = {
      inspect: vi.fn().mockResolvedValue({}),
    } as unknown as Dockerode.Image;

    // Mock dockerode
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

    // Mock container extension API
    containerExtensionAPI = {
      getEndpoints: vi.fn().mockReturnValue([{ dockerode: dockerodeMock }]),
    } as unknown as ContainerExtensionAPI;

    const extensionData = {
      exports: containerExtensionAPI,
    } as unknown as Extension<ContainerExtensionAPI>;

    vi.mocked(extensions.getExtension).mockReturnValue(extensionData);

    doclingExtension = new DoclingExtension(extensionContext);

    // Mock global fetch
    global.fetch = vi.fn();

    // Mock file system operations
    vi.mocked(mkdir).mockResolvedValue(undefined);
    vi.mocked(rm).mockResolvedValue(undefined);
    vi.mocked(copyFile).mockResolvedValue(undefined);

    // Mock util function
    vi.mocked(generateRandomFolderName).mockReturnValue('randomfolder');
  });

  describe('activate', () => {
    test('should activate successfully with existing container', async () => {
      // Mock existing container
      vi.mocked(dockerodeMock.listContainers).mockResolvedValue([
        {
          Id: 'existing-container-id',
          Labels: {
            'io.kortex.docling.port': '8080',
            'io.kortex.docling.folder': '/test/workspace',
          },
          Status: 'running',
          State: 'running',
        },
      ] as unknown as Dockerode.ContainerInfo[]);
      const spy = vi.spyOn(extensionContext.subscriptions, 'push');

      await doclingExtension.activate();

      // Verify chunk provider was registered
      expect(rag.registerChunkProvider).toHaveBeenCalled();
      expect(spy).toHaveBeenCalled();
    });

    test('should activate successfully by launching new container', async () => {
      // Mock no existing containers
      vi.mocked(dockerodeMock.listContainers).mockResolvedValue([]);

      // Mock health check
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
      } as Response);

      await doclingExtension.activate();

      // Verify container was created
      expect(mkdir).toHaveBeenCalledWith(join('/test', 'storage', 'docling-workspace'), { recursive: true });
      expect(dockerodeMock.createContainer).toHaveBeenCalled();
      expect(containerMock.start).toHaveBeenCalled();
      expect(rag.registerChunkProvider).toHaveBeenCalled();
    });

    test('should fail when container extension is not installed', async () => {
      vi.mocked(extensions.getExtension).mockReturnValue(undefined);

      await expect(doclingExtension.activate()).rejects.toThrow(
        'Mandatory extension kortex.container is not installed',
      );
    });

    test('should fail when container extension exports are missing', async () => {
      const extensionData = { exports: undefined } as unknown as Extension<ContainerExtensionAPI>;
      vi.mocked(extensions.getExtension).mockReturnValue(extensionData);

      await expect(doclingExtension.activate()).rejects.toThrow(
        'Missing exports of API in container extension kortex.container',
      );
    });

    test('should fail when container launch fails', async () => {
      // Mock no existing containers
      vi.mocked(dockerodeMock.listContainers).mockResolvedValue([]);

      // Mock container creation failure
      vi.mocked(dockerodeMock.createContainer).mockRejectedValue(new Error('Container creation failed'));

      await expect(doclingExtension.activate()).rejects.toThrow('Failed to start Docling container');
    });

    test('should restart stopped container', async () => {
      // Mock existing but stopped container
      vi.mocked(dockerodeMock.listContainers).mockResolvedValue([
        {
          Id: 'stopped-container-id',
          Labels: {
            'io.kortex.docling.port': '8080',
            'io.kortex.docling.folder': '/test/workspace',
          },
          Status: 'exited',
          State: 'exited',
        },
      ] as unknown as Dockerode.ContainerInfo[]);

      await doclingExtension.activate();

      // Verify container was started
      expect(containerMock.start).toHaveBeenCalled();
      expect(rag.registerChunkProvider).toHaveBeenCalled();
    });
  });

  describe('deactivate', () => {
    beforeEach(async () => {
      // Set up container info
      vi.mocked(dockerodeMock.listContainers).mockResolvedValue([
        {
          Id: 'test-container-id',
          Labels: {
            'io.kortex.docling.port': '8080',
            'io.kortex.docling.folder': '/test/workspace',
          },
          Status: 'running',
          State: 'running',
        },
      ] as unknown as Dockerode.ContainerInfo[]);

      await doclingExtension.activate();
    });

    test('should stop and remove container', async () => {
      vi.mocked(apiProcess.exec).mockResolvedValue({} as unknown as Awaited<ReturnType<typeof apiProcess.exec>>);

      await doclingExtension.deactivate();

      // Verify container was stopped and removed
      expect(apiProcess.exec).toHaveBeenCalledWith('podman', ['stop', 'test-container-id']);
      expect(apiProcess.exec).toHaveBeenCalledWith('podman', ['rm', 'test-container-id']);
      expect(rm).toHaveBeenCalledWith('/test/workspace', { recursive: true, force: true });
    });

    test('should handle errors when stopping container', async () => {
      vi.mocked(apiProcess.exec).mockRejectedValue(new Error('Stop failed'));
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await doclingExtension.deactivate();

      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    test('should handle errors when cleaning workspace', async () => {
      vi.mocked(apiProcess.exec).mockResolvedValue({} as unknown as Awaited<ReturnType<typeof apiProcess.exec>>);
      vi.mocked(rm).mockRejectedValue(new Error('Cleanup failed'));
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await doclingExtension.deactivate();

      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    test('should do nothing if container info is not set', async () => {
      const freshExtension = new DoclingExtension(extensionContext);
      await freshExtension.deactivate();

      expect(apiProcess.exec).not.toHaveBeenCalled();
      expect(rm).not.toHaveBeenCalled();
    });
  });

  describe('convertDocument', () => {
    beforeEach(async () => {
      // Set up container info
      vi.mocked(dockerodeMock.listContainers).mockResolvedValue([
        {
          Id: 'test-container-id',
          Labels: {
            'io.kortex.docling.port': '8080',
            'io.kortex.docling.folder': '/test/workspace',
          },
          Status: 'running',
          State: 'running',
        },
      ] as unknown as Dockerode.ContainerInfo[]);

      await doclingExtension.activate();
    });

    test('should convert document successfully', async () => {
      vi.mocked(Uri.file).mockReturnValue({ fsPath: '/path/to/document.pdf' } as unknown as Uri);
      const docUri = Uri.file('/path/to/document.pdf');

      // Mock fetch response
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          success: true,
          chunk_count: 3,
          error: null,
        }),
      } as unknown as Response);

      const chunks = await doclingExtension.convertDocument(docUri);

      expect(chunks).toHaveLength(3);
      expect(mkdir).toHaveBeenCalled();
      expect(copyFile).toHaveBeenCalled();
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

      // Mock fetch response with error
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        status: 500,
        text: vi.fn().mockResolvedValue('Internal server error'),
      } as unknown as Response);

      await expect(doclingExtension.convertDocument(docUri)).rejects.toThrow('Conversion failed');
    });

    test('should throw error if conversion result indicates failure', async () => {
      vi.mocked(Uri.file).mockReturnValue({ fsPath: '/path/to/document.pdf' } as unknown as Uri);
      const docUri = Uri.file('/path/to/document.pdf');

      // Mock fetch response with failure result
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          success: false,
          chunk_count: 0,
          error: 'Document parsing failed',
        }),
      } as unknown as Response);

      await expect(doclingExtension.convertDocument(docUri)).rejects.toThrow(
        'Conversion failed: Document parsing failed',
      );
    });

    test('should clean up folder on error', async () => {
      vi.mocked(Uri.file).mockReturnValue({ fsPath: '/path/to/document.pdf' } as unknown as Uri);
      const docUri = Uri.file('/path/to/document.pdf');

      // Mock fetch to throw error
      vi.mocked(global.fetch).mockRejectedValue(new Error('Network error'));

      await expect(doclingExtension.convertDocument(docUri)).rejects.toThrow('Network error');

      // Verify cleanup was attempted (rm was called)
      expect(rm).toHaveBeenCalled();
    });
  });

  describe('discoverExistingContainer', () => {
    test('should discover running container', async () => {
      vi.mocked(dockerodeMock.listContainers).mockResolvedValue([
        {
          Id: 'existing-container-id',
          Labels: {
            'io.kortex.docling.port': '8080',
            'io.kortex.docling.folder': '/test/workspace',
          },
          Status: 'running',
          State: 'running',
        },
      ] as unknown as Dockerode.ContainerInfo[]);

      const result = await doclingExtension.discoverExistingContainer(containerExtensionAPI);

      expect(result).toEqual({
        containerId: 'existing-container-id',
        port: 8080,
        workspaceFolder: '/test/workspace',
      });
    });

    test('should restart stopped container', async () => {
      vi.mocked(dockerodeMock.listContainers).mockResolvedValue([
        {
          Id: 'stopped-container-id',
          Labels: {
            'io.kortex.docling.port': '8080',
            'io.kortex.docling.folder': '/test/workspace',
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
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await doclingExtension.discoverExistingContainer(containerExtensionAPI);

      expect(result).toBeUndefined();
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    test('should handle errors when getting endpoints', async () => {
      vi.mocked(containerExtensionAPI.getEndpoints).mockImplementation(() => {
        throw new Error('Failed to get endpoints');
      });
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await doclingExtension.discoverExistingContainer(containerExtensionAPI);

      expect(result).toBeUndefined();
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('launchContainer', () => {
    test('should launch container successfully when image exists', async () => {
      // Mock health check
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
      } as Response);

      const result = await doclingExtension.launchContainer(containerExtensionAPI);

      expect(mkdir).toHaveBeenCalledWith(join('/test', 'storage', 'docling-workspace'), { recursive: true });
      expect(imageMock.inspect).toHaveBeenCalled();
      expect(dockerodeMock.createContainer).toHaveBeenCalled();
      expect(containerMock.start).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result.containerId).toBe('test-container-id');
    });

    test('should pull image if not available', async () => {
      // Mock image not found
      vi.mocked(imageMock.inspect).mockRejectedValue(new Error('Image not found'));

      // Mock health check
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
        'No container enigine endpoint found',
      );
    });

    test('should throw error when container creation fails', async () => {
      vi.mocked(dockerodeMock.createContainer).mockRejectedValue(new Error('Creation failed'));

      await expect(doclingExtension.launchContainer(containerExtensionAPI)).rejects.toThrow(
        'Failed to start Docling container',
      );
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
            'io.kortex.docling.port': '8080',
            'io.kortex.docling.folder': '/test/workspace',
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
            'io.kortex.docling.port': '8080',
            'io.kortex.docling.folder': '/test/workspace',
          },
          Status: 'running',
          State: 'running',
        },
      ] as unknown as Dockerode.ContainerInfo[]);

      await doclingExtension.activate();

      const docUri = Uri.file('/path/to/document.pdf');
      vi.mocked(global.fetch).mockRejectedValue(new Error('Conversion error'));

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(registeredProvider!.chunk(docUri)).rejects.toThrow('Conversion error');

      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to convert document:', expect.any(Error));
      consoleErrorSpy.mockRestore();
    });
  });
});
