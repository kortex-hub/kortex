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

import type { ExtensionContext, Provider, TelemetryLogger } from '@kortex-app/api';
import type { ContainerExtensionAPI } from '@kortex-app/container-extension-api';
import { Container } from 'inversify';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { handlersModule } from '/@/handler/_module';
import { helpersModule } from '/@/helper/_module';
import { managersModule } from '/@/manager/_manager-module';
import { InferenceModelManager } from '/@/manager/inference-model-manager';

import { InversifyBinding } from './inversify-binding';
import { ContainerExtensionAPISymbol, ExtensionContextSymbol, RamalamaProvider, TelemetryLoggerSymbol } from './symbol';

let inversifyBinding: InversifyBinding;

const containerExtensionAPIMock = {} as unknown as ContainerExtensionAPI;
const extensionContextMock = {} as ExtensionContext;
const telemetryLoggerMock = {} as TelemetryLogger;
const providerMock = {} as Provider;

// mock inversify
vi.mock(import('inversify'));

describe('InversifyBinding', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    inversifyBinding = new InversifyBinding(
      providerMock,
      containerExtensionAPIMock,
      extensionContextMock,
      telemetryLoggerMock,
    );
    vi.mocked(Container.prototype.bind).mockReturnValue({
      toConstantValue: vi.fn(),
    } as unknown as ReturnType<typeof Container.prototype.bind>);
  });

  test('should initialize bindings correctly', async () => {
    // Initialize bindings
    const container = await inversifyBinding.initBindings();

    await container.getAsync(InferenceModelManager);

    // check we call bind
    expect(vi.mocked(Container.prototype.bind)).toHaveBeenCalledWith(ExtensionContextSymbol);
    expect(vi.mocked(Container.prototype.bind)).toHaveBeenCalledWith(ContainerExtensionAPISymbol);
    expect(vi.mocked(Container.prototype.bind)).toHaveBeenCalledWith(TelemetryLoggerSymbol);
    expect(vi.mocked(Container.prototype.bind)).toHaveBeenCalledWith(RamalamaProvider);

    // expect load of modules
    expect(vi.mocked(Container.prototype.load)).toHaveBeenCalledWith(handlersModule);
    expect(vi.mocked(Container.prototype.load)).toHaveBeenCalledWith(helpersModule);
    expect(vi.mocked(Container.prototype.load)).toHaveBeenCalledWith(managersModule);
  });

  test('should dispose of the container', async () => {
    const container = await inversifyBinding.initBindings();

    // Dispose of the container
    await inversifyBinding.dispose();

    // instances gone
    expect(container.unbindAll).toHaveBeenCalled();
  });
});
