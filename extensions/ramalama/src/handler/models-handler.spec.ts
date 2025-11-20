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

import * as kortexApi from '@kortex-app/api';
import type { ContainerExtensionAPI, EndpointConnection } from '@kortex-app/container-extension-api';
import { Container, injectFromBase } from 'inversify';
import { beforeEach, expect, test, vi } from 'vitest';

import type { ModelInfo } from '/@/api/model-info';
import type { RamalamaContainerInfo } from '/@/api/ramalama-container-info';
import { ContainerModelExtractor } from '/@/helper/container-model-extractor';
import { ContainerRamaLamaFinder } from '/@/helper/container-ramalama-finder';
import { ContainerExtensionAPISymbol } from '/@/inject/symbol';

import { ModelsHandler } from './models-handler';

const containerRamaLamaFinderMock = {
  getRamaLamaContainers: vi.fn(),
} as unknown as ContainerRamaLamaFinder;

const containerModelExtractorMock = {
  extractModelInfo: vi.fn(),
} as unknown as ContainerModelExtractor;

const containerExtensionAPIMock = {
  onEndpointsChanged: vi.fn(),
  onContainersChanged: vi.fn(),
  getEndpoints: vi.fn().mockReturnValue([]),
} as unknown as ContainerExtensionAPI;

@injectFromBase()
class TestModelsHandler extends ModelsHandler {
  getModels(): readonly ModelInfo[] {
    return super.getModels();
  }

  getModelsChanged(): kortexApi.EventEmitter<readonly ModelInfo[]> {
    return super.getModelsChanged();
  }
}

let modelsHandler: TestModelsHandler;

beforeEach(async () => {
  vi.resetAllMocks();
  const api = kortexApi as unknown as { init: () => void };
  api.init();
  const container = new Container();
  container.bind(TestModelsHandler).toSelf().inSingletonScope();
  container.bind(ContainerRamaLamaFinder).toConstantValue(containerRamaLamaFinderMock);
  container.bind(ContainerModelExtractor).toConstantValue(containerModelExtractorMock);
  container.bind(ContainerExtensionAPISymbol).toConstantValue(containerExtensionAPIMock);
  modelsHandler = await container.getAsync<TestModelsHandler>(TestModelsHandler);
});

test('should initialize listeners', async () => {
  await modelsHandler.init();

  expect(containerExtensionAPIMock.onEndpointsChanged).toHaveBeenCalled();
  expect(containerExtensionAPIMock.onContainersChanged).toHaveBeenCalled();
  expect(containerExtensionAPIMock.getEndpoints).toHaveBeenCalled();
  expect(modelsHandler.getModels().length).toBe(0);

  // now check that calling the endpoints changed calls refreshModels
  const endpointsChangedCallback = vi.mocked(containerExtensionAPIMock.onEndpointsChanged).mock.calls[0][0];
  await endpointsChangedCallback([]);

  const containersChangedCallback = vi.mocked(containerExtensionAPIMock.onContainersChanged).mock.calls[0][0];
  await containersChangedCallback();
});

test('test log failures on container change event', async () => {
  await modelsHandler.init();

  const consoleErrorSpy = vi.spyOn(console, 'error');
  const spyRefreshModels = vi.spyOn(modelsHandler, 'refreshModels');
  spyRefreshModels.mockRejectedValueOnce(new Error('Test error'));

  const containersChangedCallback = vi.mocked(containerExtensionAPIMock.onContainersChanged).mock.calls[0][0];
  await containersChangedCallback();
  expect(spyRefreshModels).toHaveBeenCalled();
  expect(consoleErrorSpy).toHaveBeenCalledWith('Error refreshing models:', expect.any(Error));
});

test('test log failures on endpoint change event', async () => {
  await modelsHandler.init();

  const consoleErrorSpy = vi.spyOn(console, 'error');
  const spyRefreshModels = vi.spyOn(modelsHandler, 'refreshModels');
  spyRefreshModels.mockRejectedValueOnce(new Error('Test error'));

  const endpointsChangedCallback = vi.mocked(containerExtensionAPIMock.onEndpointsChanged).mock.calls[0][0];
  await endpointsChangedCallback([]);
  expect(spyRefreshModels).toHaveBeenCalled();
  expect(consoleErrorSpy).toHaveBeenCalledWith('Error refreshing models:', expect.any(Error));
});

test('should dispose', async () => {
  modelsHandler.dispose();
  expect(modelsHandler.getModelsChanged().dispose).toHaveBeenCalled();
});

test('should refresh models when connections have RamaLama containers', async () => {
  const mockContainer1 = { Id: 'container1', Names: ['/ramalama-container1'] } as unknown as RamalamaContainerInfo;
  const mockContainer2 = { Id: 'container2', Names: ['/ramalama-container2'] } as unknown as RamalamaContainerInfo;

  const mockModelInfo1: ModelInfo = { id: 'model1', name: 'Test Model 1' } as unknown as ModelInfo;
  const mockModelInfo2: ModelInfo = { id: 'model2', name: 'Test Model 2' } as unknown as ModelInfo;

  const mockConnection = {
    path: '/var/run/docker.sock',
    dockerode: {
      listContainers: vi.fn().mockResolvedValue([mockContainer1, mockContainer2]),
    },
  } as unknown as EndpointConnection;

  vi.mocked(containerExtensionAPIMock.getEndpoints).mockReturnValue([mockConnection]);
  vi.mocked(containerRamaLamaFinderMock.getRamaLamaContainers).mockResolvedValue([mockContainer1, mockContainer2]);
  vi.mocked(containerModelExtractorMock.extractModelInfo)
    .mockResolvedValueOnce(mockModelInfo1)
    .mockResolvedValueOnce(mockModelInfo2);

  await modelsHandler.init();

  await modelsHandler.refreshModels();

  expect(containerRamaLamaFinderMock.getRamaLamaContainers).toHaveBeenCalledWith([mockContainer1, mockContainer2]);
  expect(containerModelExtractorMock.extractModelInfo).toHaveBeenCalledTimes(2);
  expect(containerModelExtractorMock.extractModelInfo).toHaveBeenCalledWith(mockContainer1);
  expect(containerModelExtractorMock.extractModelInfo).toHaveBeenCalledWith(mockContainer2);
  expect(modelsHandler.getModels()).toEqual([mockModelInfo1, mockModelInfo2]);
  expect(modelsHandler.getModelsChanged().fire).toHaveBeenCalledWith([mockModelInfo1, mockModelInfo2]);
});

test('should handle connection errors gracefully', async () => {
  const mockConnection = {
    path: '/var/run/docker.sock',
    dockerode: {
      listContainers: vi.fn().mockRejectedValue(new Error('Connection failed')),
    },
  } as unknown as EndpointConnection;

  vi.mocked(containerExtensionAPIMock.getEndpoints).mockReturnValue([mockConnection]);

  await modelsHandler.init();

  const consoleErrorSpy = vi.spyOn(console, 'error');

  await modelsHandler.refreshModels();

  expect(consoleErrorSpy).toHaveBeenCalledWith('Error connecting to socket /var/run/docker.sock:', expect.any(Error));
  expect(modelsHandler.getModels()).toEqual([]);
  expect(modelsHandler.getModelsChanged().fire).toHaveBeenCalledWith([]);
});
