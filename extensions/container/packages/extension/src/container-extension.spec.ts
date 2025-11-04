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

import type { ExtensionContext } from '@kortex-app/api';
import type { Container } from 'inversify';
import { beforeEach, expect, test, vi } from 'vitest';

import { ContainerExtension } from '/@/container-extension';
import { ContainerEngineManager } from '/@/manager/container-engine-manager';

vi.mock(import('@kortex-app/api'));
vi.mock(import('./manager/container-engine-manager'));

class TestContainerExtension extends ContainerExtension {
  getContainer(): Container | undefined {
    return super.getContainer();
  }
}

let extensionContext: ExtensionContext;
let containerExtension: TestContainerExtension;

beforeEach(async () => {
  vi.resetAllMocks();
  vi.clearAllMocks();
  extensionContext = { subscriptions: [] } as unknown as ExtensionContext;
  containerExtension = new TestContainerExtension(extensionContext);
});

test('activate', async () => {
  await containerExtension.activate();
  expect(ContainerEngineManager.prototype.init).toHaveBeenCalled();
});

test('activate handles error during container creation', async () => {
  // bind an object that will throw when getAsync is called
  const faultyGetAsync = vi.fn().mockRejectedValue(new Error('Container creation failed'));
  vi.spyOn(containerExtension, 'getContainer').mockReturnValue({
    getAsync: faultyGetAsync,
  } as unknown as Container);
  await expect(containerExtension.activate()).rejects.toThrow('Container creation failed');
});

test('deactivate disposes subscriptions', async () => {
  await containerExtension.activate();
  await containerExtension.deactivate();
  expect(ContainerEngineManager.prototype.dispose).toHaveBeenCalled();
});
