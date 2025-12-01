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
import * as api from '@kortex-app/api';
import type { ContainerExtensionAPI } from '@kortex-app/container-extension-api';
import type { Container } from 'inversify';

import { InversifyBinding } from '/@/inject/inversify-binding';
import { ConnectionManager } from '/@/manager/connection-manager';

export class MilvusExtension {
  #extensionContext: ExtensionContext;
  #inversifyBinding: InversifyBinding | undefined;
  #container: Container | undefined;
  #connectionManager: ConnectionManager | undefined;

  constructor(extensionContext: ExtensionContext) {
    this.#extensionContext = extensionContext;
  }

  async activate(): Promise<void> {
    const KORTEX_CONTAINER_EXTENSION_ID = 'kortex.container';
    const containerExtension = api.extensions.getExtension<ContainerExtensionAPI>(KORTEX_CONTAINER_EXTENSION_ID);
    if (!containerExtension) {
      throw new Error('Mandatory extension ${KORTEX_CONTAINER_EXTENSION_ID} is not installed');
    }
    const containerExtensionAPI = containerExtension?.exports;
    if (!containerExtensionAPI) {
      throw new Error(`Missing exports of API in container extension ${KORTEX_CONTAINER_EXTENSION_ID}`);
    }

    // Create the Milvus provider
    const milvusProvider = api.provider.createProvider({
      id: 'milvus',
      name: 'Milvus',
      status: 'ready',
      emptyConnectionMarkdownDescription: 'Provides creation of Milvus vector databases',
      images: {
        icon: './milvus-icon-color.png',
      },
    });

    this.#inversifyBinding = new InversifyBinding(milvusProvider, containerExtensionAPI, this.#extensionContext);
    this.#container = await this.#inversifyBinding.initBindings();

    try {
      this.#connectionManager = await this.getContainer()?.getAsync(ConnectionManager);
    } catch (e) {
      console.error('Error while creating the container provider manager', e);
      throw e;
    }

    await this.#connectionManager?.init();
  }

  protected getContainer(): Container | undefined {
    return this.#container;
  }

  async deactivate(): Promise<void> {
    this.#connectionManager?.dispose();
  }
}
