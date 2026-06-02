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
import type { Container } from 'inversify';

import { InversifyBinding } from '/@/inject/inversify-binding';
import { OpenshellCliManager } from '/@/manager/openshell-cli-manager';

export class OpenshellExtension {
  #extensionContext: ExtensionContext;

  #inversifyBinding: InversifyBinding | undefined;
  #container: Container | undefined;
  #openshellCliManager: OpenshellCliManager | undefined;

  constructor(extensionContext: ExtensionContext) {
    this.#extensionContext = extensionContext;
  }

  async activate(): Promise<void> {
    this.#inversifyBinding = new InversifyBinding(this.#extensionContext);
    this.#container = await this.#inversifyBinding.initBindings();

    try {
      this.#openshellCliManager = await this.getContainer()?.getAsync(OpenshellCliManager);
    } catch (e) {
      console.error('Error while creating the OpenShell CLI manager', e);
      throw e;
    }

    await this.#openshellCliManager?.init();
  }

  protected getContainer(): Container | undefined {
    return this.#container;
  }

  async deactivate(): Promise<void> {
    await this.#inversifyBinding?.dispose();
    this.#openshellCliManager?.dispose();
    this.#openshellCliManager = undefined;
  }
}
