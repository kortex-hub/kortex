/**********************************************************************
 * Copyright (C) 2025 Red Hat, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
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

import { env, type ExtensionContext, provider } from '@kortex-app/api';
import type { Container } from 'inversify';

import { InversifyBinding } from '/@/inject/inversify-binding';
import { SchedulerManager } from '/@/manager/scheduler-manager';

export class SchedulerExtension {
  #extensionContext: ExtensionContext;

  #inversifyBinding: InversifyBinding | undefined;
  #container: Container | undefined;
  #schedulerManager: SchedulerManager | undefined;

  constructor(extensionContext: ExtensionContext) {
    this.#extensionContext = extensionContext;
  }

  async activate(): Promise<void> {
    const telemetryLogger = env.createTelemetryLogger();

    let emptyConnectionMarkdownDescription = '';
    if (env.isMac) {
      emptyConnectionMarkdownDescription = 'Provides support of scheduling tasks using macOS Launch Agents.';
    } else if (env.isWindows) {
      emptyConnectionMarkdownDescription = 'Provides support of scheduling tasks using Windows SchTasks.';
    } else if (env.isLinux) {
      // no scheduler support for Linux yet
      return;
    }

    const schedulerProvider = provider.createProvider({
      name: 'Native Scheduler',
      status: 'unknown',
      id: 'scheduler',
      emptyConnectionMarkdownDescription,
      images: {
        icon: './icon.png',
        logo: {
          dark: './icon.png',
          light: './icon.png',
        },
      },
    });

    this.#inversifyBinding = new InversifyBinding(schedulerProvider, this.#extensionContext, telemetryLogger);
    this.#container = await this.#inversifyBinding.initBindings();

    try {
      this.#schedulerManager = await this.getContainer()?.getAsync(SchedulerManager);
    } catch (e) {
      console.error('Error while creating the container provider manager', e);
      throw e;
    }

    await this.#schedulerManager?.init();

    this.#extensionContext.subscriptions.push(schedulerProvider);
  }

  protected getContainer(): Container | undefined {
    return this.#container;
  }

  async deactivate(): Promise<void> {
    await this.#inversifyBinding?.dispose();
    this.#schedulerManager?.dispose();
    this.#schedulerManager = undefined;
  }
}
