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

import type { Extension, ExtensionContext, Provider } from '@openkaiden/api';
import { extensions, provider as providerApi } from '@openkaiden/api';
import type { ContainerExtensionAPI } from '@openkaiden/container-extension-api';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { InversifyBinding } from '/@/inject/inversify-binding';
import type { ConnectionManager } from '/@/manager/connection-manager';

import { DoclingExtension } from './docling-extension';

vi.mock(import('/@/inject/inversify-binding'));
vi.mock(import('/@/manager/connection-manager'));

describe('DoclingExtension', () => {
  let extensionContext: ExtensionContext;
  let doclingExtension: DoclingExtension;
  let containerExtensionAPI: ContainerExtensionAPI;
  let providerMock: Provider;
  let connectionManagerMock: ConnectionManager;
  let inversifyBindingMock: InversifyBinding;

  beforeEach(() => {
    vi.resetAllMocks();

    extensionContext = {
      subscriptions: [],
      storagePath: '/test/storage',
    } as unknown as ExtensionContext;

    providerMock = {
      setChunkProviderConnectionFactory: vi.fn().mockReturnValue({ dispose: vi.fn() }),
      registerChunkProviderConnection: vi.fn().mockReturnValue({ dispose: vi.fn() }),
      dispose: vi.fn(),
    } as unknown as Provider;

    vi.mocked(providerApi.createProvider).mockReturnValue(providerMock);

    containerExtensionAPI = {
      getEndpoints: vi.fn().mockReturnValue([]),
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
  });

  describe('activate', () => {
    test('should create provider and initialize InversifyBinding', async () => {
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
      await doclingExtension.activate();

      expect(connectionManagerMock.init).toHaveBeenCalled();
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
  });

  describe('deactivate', () => {
    test('should dispose ConnectionManager and InversifyBinding on deactivate', async () => {
      await doclingExtension.activate();
      await doclingExtension.deactivate();

      expect(connectionManagerMock.dispose).toHaveBeenCalled();
      expect(inversifyBindingMock.dispose).toHaveBeenCalled();
    });

    test('should handle deactivate when not activated', async () => {
      await doclingExtension.deactivate();

      expect(connectionManagerMock.dispose).not.toHaveBeenCalled();
      expect(inversifyBindingMock.dispose).not.toHaveBeenCalled();
    });
  });
});
