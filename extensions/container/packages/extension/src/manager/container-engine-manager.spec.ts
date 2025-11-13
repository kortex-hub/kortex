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

import { Container } from 'inversify';
import { beforeEach, expect, test, vi } from 'vitest';

import { ContainerEndpointHandler } from '/@/handler/container-endpoint-handler';

import { ContainerEngineManager } from './container-engine-manager';

const containerEndpointHandlerMock: ContainerEndpointHandler = {
  init: vi.fn(),
  dispose: vi.fn(),
  onContainersChanged: vi.fn(),
  onEndpointsChanged: vi.fn(),
  getEndpoints: vi.fn(),
} as unknown as ContainerEndpointHandler;

let containerEngineManager: ContainerEngineManager;

beforeEach(async () => {
  vi.resetAllMocks();
  const container = new Container();
  container.bind(ContainerEngineManager).toSelf();
  container.bind(ContainerEndpointHandler).toConstantValue(containerEndpointHandlerMock);
  containerEngineManager = await container.getAsync<ContainerEngineManager>(ContainerEngineManager);
});

test('init', async () => {
  await containerEngineManager.init();

  expect(containerEndpointHandlerMock.init).toHaveBeenCalled();
});

test('exports', () => {
  const exports = containerEngineManager.exports();

  exports.onContainersChanged(() => {});
  exports.onEndpointsChanged(() => {});

  expect(containerEndpointHandlerMock.onContainersChanged).toHaveBeenCalledTimes(1);
  expect(containerEndpointHandlerMock.onEndpointsChanged).toHaveBeenCalledTimes(1);

  // get the callback registered with onContainersChanged
  const onContainersChangedCallback = vi.mocked(containerEndpointHandlerMock.onContainersChanged).mock.calls[0]?.[0];
  expect(onContainersChangedCallback).toBeDefined();

  const onEndpointsChangedCallback = vi.mocked(containerEndpointHandlerMock.onEndpointsChanged).mock.calls[0]?.[0];
  expect(onEndpointsChangedCallback).toBeDefined();
});

test('dispose', () => {
  containerEngineManager.dispose();
  expect(containerEndpointHandlerMock.dispose).toHaveBeenCalled();
});
