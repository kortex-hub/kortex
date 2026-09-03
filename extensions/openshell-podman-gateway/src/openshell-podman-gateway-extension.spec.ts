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

import type { Extension, ExtensionContext } from '@openkaiden/api';
import { extensions } from '@openkaiden/api';
import type { ContainerExtensionAPI } from '@openkaiden/container-extension-api';
import { beforeEach, expect, test, vi } from 'vitest';

import { InversifyBinding } from '/@/inject/inversify-binding';
import { GatewayContainerManager } from '/@/manager/gateway-container-manager';

import { OpenshellPodmanGatewayExtension } from './openshell-podman-gateway-extension';

vi.mock(import('./inject/inversify-binding'));
vi.mock(import('./manager/gateway-container-manager'));

const disposableMock = {
  dispose: vi.fn().mockResolvedValue(undefined),
};

let extensionContextMock: ExtensionContext;
let gatewayContainerManagerMock: GatewayContainerManager;

beforeEach(() => {
  vi.resetAllMocks();

  extensionContextMock = {
    storagePath: '/test/storage',
    subscriptions: [],
  } as unknown as ExtensionContext;

  vi.mocked(extensions.getExtension<ContainerExtensionAPI>).mockReturnValue({
    exports: {
      getEndpoints: vi.fn().mockReturnValue([]),
      onContainersChanged: vi.fn().mockReturnValue(disposableMock),
      onEndpointsChanged: vi.fn().mockReturnValue(disposableMock),
    },
  } as unknown as Extension<ContainerExtensionAPI>);

  gatewayContainerManagerMock = new GatewayContainerManager();
  vi.mocked(gatewayContainerManagerMock.init).mockResolvedValue(undefined);

  vi.mocked(InversifyBinding.prototype.initBindings).mockResolvedValue({
    getAsync: vi.fn().mockResolvedValue(gatewayContainerManagerMock),
  } as never);
});

test('should activate and initialize the gateway container manager', async () => {
  const ext = new OpenshellPodmanGatewayExtension(extensionContextMock);
  await ext.activate();

  expect(gatewayContainerManagerMock.init).toHaveBeenCalled();
});

test('should throw when container extension is not installed', async () => {
  vi.mocked(extensions.getExtension<ContainerExtensionAPI>).mockReturnValue(
    undefined as unknown as Extension<ContainerExtensionAPI>,
  );

  const ext = new OpenshellPodmanGatewayExtension(extensionContextMock);

  await expect(ext.activate()).rejects.toThrow('Mandatory extension kaiden.container is not installed');
});

test('should throw when container extension has no exports', async () => {
  vi.mocked(extensions.getExtension<ContainerExtensionAPI>).mockReturnValue({
    exports: undefined,
  } as unknown as Extension<ContainerExtensionAPI>);

  const ext = new OpenshellPodmanGatewayExtension(extensionContextMock);

  await expect(ext.activate()).rejects.toThrow('Missing exports of API in container extension kaiden.container');
});

test('should call deactivate without error', async () => {
  const ext = new OpenshellPodmanGatewayExtension(extensionContextMock);
  await ext.activate();
  await ext.deactivate();

  expect(gatewayContainerManagerMock.dispose).toHaveBeenCalled();
});

test('should not fail when deactivate is called without activate', async () => {
  const ext = new OpenshellPodmanGatewayExtension(extensionContextMock);

  await expect(ext.deactivate()).resolves.toBeUndefined();
});
