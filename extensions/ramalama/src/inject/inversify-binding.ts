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

import type { ExtensionContext as PodmanDesktopExtensionContext, Provider, TelemetryLogger } from '@kortex-app/api';
import type { ContainerExtensionAPI } from '@kortex-app/container-extension-api';
import { Container } from 'inversify';

import {
  ContainerExtensionAPISymbol,
  ExtensionContextSymbol,
  RamalamaProvider,
  TelemetryLoggerSymbol,
} from '/@/inject/symbol';
import { managersModule } from '/@/manager/_manager-module';
import { InferenceModelManager } from '/@/manager/inference-model-manager';

export class InversifyBinding {
  #container: Container | undefined;

  readonly #provider: Provider;
  readonly #containerExtensionAPI: ContainerExtensionAPI;
  readonly #extensionContext: PodmanDesktopExtensionContext;
  readonly #telemetryLogger: TelemetryLogger;

  constructor(
    provider: Provider,
    containerExtensionAPI: ContainerExtensionAPI,
    extensionContext: PodmanDesktopExtensionContext,
    telemetryLogger: TelemetryLogger,
  ) {
    this.#provider = provider;
    this.#containerExtensionAPI = containerExtensionAPI;
    this.#extensionContext = extensionContext;
    this.#telemetryLogger = telemetryLogger;
  }

  public async initBindings(): Promise<Container> {
    this.#container = new Container();

    this.#container.bind(ExtensionContextSymbol).toConstantValue(this.#extensionContext);
    this.#container.bind(ContainerExtensionAPISymbol).toConstantValue(this.#containerExtensionAPI);
    this.#container.bind(TelemetryLoggerSymbol).toConstantValue(this.#telemetryLogger);
    this.#container.bind(RamalamaProvider).toConstantValue(this.#provider);

    await this.#container.load(managersModule);

    // Get inference model manager
    await this.#container.getAsync(InferenceModelManager);
    return this.#container;
  }

  async dispose(): Promise<void> {
    if (this.#container) {
      await this.#container.unbindAll();
    }
  }
}
