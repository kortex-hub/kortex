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

import type { OpenAICompatibleProvider } from '@ai-sdk/openai-compatible';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { Provider } from '@kortex-app/api';
import { Container } from 'inversify';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { ModelsHandler } from '/@/handler/models-handler';

import type { ModelInfo } from '../api/model-info';
import { RamalamaProvider } from '../inject/symbol';
import { InferenceModelManager } from './inference-model-manager';

vi.mock(import('@ai-sdk/openai-compatible'));

const modelsHandlerMock: ModelsHandler = {
  init: vi.fn(),
  onModelsChanged: vi.fn(),
} as unknown as ModelsHandler;
const ramaLamaProviderMock: Provider = {
  registerInferenceProviderConnection: vi.fn(),
} as unknown as Provider;

describe('InferenceModelManager', () => {
  let inferenceModelManager: InferenceModelManager;

  beforeEach(async () => {
    vi.resetAllMocks();
    const container = new Container();
    container.bind(InferenceModelManager).toSelf();
    container.bind(ModelsHandler).toConstantValue(modelsHandlerMock);
    container.bind(RamalamaProvider).toConstantValue(ramaLamaProviderMock);
    inferenceModelManager = await container.getAsync<InferenceModelManager>(InferenceModelManager);
  });

  test('registers each model with the provider using the created sdk', async () => {
    // fake the sdk instance
    const sdkInstance: OpenAICompatibleProvider = {} as unknown as OpenAICompatibleProvider;
    vi.mocked(createOpenAICompatible).mockReturnValueOnce(sdkInstance);

    const modelName = 'ModelA';
    const modelPort = 1234;
    await inferenceModelManager.refreshRegistrationOfModels([{ name: modelName, port: modelPort }]);

    expect(vi.mocked(createOpenAICompatible)).toHaveBeenCalledWith({
      baseURL: `http://localhost:${modelPort}`,
      name: `RamaLama/${modelPort}`,
    });
    expect(vi.mocked(ramaLamaProviderMock.registerInferenceProviderConnection)).toHaveBeenCalledWith(
      expect.objectContaining({
        name: `port/${modelPort}`,
        sdk: sdkInstance,
        models: [{ label: modelName }],
      }),
    );
  });

  test('init wires model changes to refresh logic and initializes handler', async () => {
    // mock the redreshRegistrationOfModels method
    const refreshRegistrationOfModelsSpy = vi.spyOn(inferenceModelManager, 'refreshRegistrationOfModels');
    await inferenceModelManager.init();

    expect(modelsHandlerMock.onModelsChanged).toHaveBeenCalledTimes(1);
    expect(modelsHandlerMock.init).toHaveBeenCalledTimes(1);

    const modelsSample = [{ name: 'ModelThree', port: 3000 }] as ModelInfo[];

    // get the callback registered with onModelsChanged
    const onModelsChangedCallback = vi.mocked(modelsHandlerMock.onModelsChanged).mock.calls[0]?.[0];
    expect(onModelsChangedCallback).toBeDefined();

    // call the callback
    await onModelsChangedCallback?.(modelsSample);

    expect(refreshRegistrationOfModelsSpy).toHaveBeenCalledWith(modelsSample);

    // expect init method on modelsHandler to be called
    expect(modelsHandlerMock.init).toHaveBeenCalled();
  });
});
