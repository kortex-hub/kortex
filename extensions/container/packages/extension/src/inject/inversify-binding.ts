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
import { Container } from 'inversify';

import { handlersModule } from '/@/handler/_handler-module';
import { helpersModule } from '/@/helper/_helper-module';
import { ContainersProvider, ExtensionContextSymbol, TelemetryLoggerSymbol } from '/@/inject/symbol';
import { managersModule } from '/@/manager/_manager-module';
import { ContainerEngineManager } from '/@/manager/container-engine-manager';

export class InversifyBinding {
  #container: Container | undefined;

  readonly #provider: Provider;
  readonly #extensionContext: ExtensionContext;
  readonly #telemetryLogger: TelemetryLogger;

  constructor(provider: Provider, extensionContext: ExtensionContext, telemetryLogger: TelemetryLogger) {
    this.#provider = provider;
    this.#extensionContext = extensionContext;
    this.#telemetryLogger = telemetryLogger;
  }

  public async initBindings(): Promise<Container> {
    this.#container = new Container();

    this.#container.bind(ExtensionContextSymbol).toConstantValue(this.#extensionContext);
    this.#container.bind(TelemetryLoggerSymbol).toConstantValue(this.#telemetryLogger);
    this.#container.bind(ContainersProvider).toConstantValue(this.#provider);

    await this.#container.load(helpersModule);
    await this.#container.load(handlersModule);
    await this.#container.load(managersModule);

    // Resolve container engine manager to ensure initialization
    await this.#container.getAsync(ContainerEngineManager);
    return this.#container;
  }

  async dispose(): Promise<void> {
    if (this.#container) {
      await this.#container.unbindAll();
    }
  }
}
