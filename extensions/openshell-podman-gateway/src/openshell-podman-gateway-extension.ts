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
import * as api from '@openkaiden/api';
import type { ContainerExtensionAPI } from '@openkaiden/container-extension-api';
import type { Container } from 'inversify';

import { InversifyBinding } from '/@/inject/inversify-binding';
import { GatewayContainerManager } from '/@/manager/gateway-container-manager';

export class OpenshellPodmanGatewayExtension {
  #extensionContext: ExtensionContext;
  #inversifyBinding: InversifyBinding | undefined;
  #container: Container | undefined;
  #gatewayContainerManager: GatewayContainerManager | undefined;

  constructor(extensionContext: ExtensionContext) {
    this.#extensionContext = extensionContext;
  }

  async activate(): Promise<void> {
    const KAIDEN_CONTAINER_EXTENSION_ID = 'kaiden.container';
    const containerExtension = api.extensions.getExtension<ContainerExtensionAPI>(KAIDEN_CONTAINER_EXTENSION_ID);
    if (!containerExtension) {
      throw new Error(`Mandatory extension ${KAIDEN_CONTAINER_EXTENSION_ID} is not installed`);
    }
    const containerExtensionAPI = containerExtension?.exports;
    if (!containerExtensionAPI) {
      throw new Error(`Missing exports of API in container extension ${KAIDEN_CONTAINER_EXTENSION_ID}`);
    }

    this.#inversifyBinding = new InversifyBinding(containerExtensionAPI, this.#extensionContext);
    this.#container = await this.#inversifyBinding.initBindings();

    try {
      this.#gatewayContainerManager = await this.getContainer()?.getAsync(GatewayContainerManager);
    } catch (e) {
      console.error('Error while creating the gateway container manager', e);
      throw e;
    }

    await this.#gatewayContainerManager?.init();
  }

  protected getContainer(): Container | undefined {
    return this.#container;
  }

  async deactivate(): Promise<void> {
    this.#gatewayContainerManager?.dispose();
  }
}
