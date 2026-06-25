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

import type { ExtensionContext } from '@openkaiden/api';
import { beforeEach, expect, test, vi } from 'vitest';

import { activate, deactivate } from './extension';
import { OpenshellPodmanGatewayExtension } from './openshell-podman-gateway-extension';

let extensionContextMock: ExtensionContext;

vi.mock(import('./openshell-podman-gateway-extension'));

beforeEach(() => {
  vi.resetAllMocks();

  extensionContextMock = {} as ExtensionContext;
  vi.mocked(OpenshellPodmanGatewayExtension.prototype.activate).mockResolvedValue(undefined);
});

test('should initialize and activate the extension when activate is called', async () => {
  await activate(extensionContextMock);

  expect(OpenshellPodmanGatewayExtension.prototype.activate).toHaveBeenCalled();
});

test('should call deactivate when deactivate is called', async () => {
  await activate(extensionContextMock);

  await deactivate();

  expect(OpenshellPodmanGatewayExtension.prototype.deactivate).toHaveBeenCalled();
});

test('should handle errors during activation', async () => {
  const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  const error = new Error('Activation failed');

  vi.mocked(OpenshellPodmanGatewayExtension.prototype.activate).mockRejectedValue(error);

  await activate(extensionContextMock);

  expect(consoleErrorSpy).toHaveBeenCalledWith(error);
});

test('should not fail when deactivate is called before activate', async () => {
  await expect(deactivate()).resolves.toBeUndefined();
});

test('should reuse existing extension instance on subsequent activate calls', async () => {
  await activate(extensionContextMock);
  await activate(extensionContextMock);

  expect(OpenshellPodmanGatewayExtension).toHaveBeenCalledTimes(1);
  expect(OpenshellPodmanGatewayExtension.prototype.activate).toHaveBeenCalledTimes(2);
});
