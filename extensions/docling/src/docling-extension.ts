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

import * as api from '@openkaiden/api';
import type { ContainerExtensionAPI } from '@openkaiden/container-extension-api';
import type { Container } from 'inversify';

import { InversifyBinding } from '/@/inject/inversify-binding';
import { ConnectionManager } from '/@/manager/connection-manager';

export class DoclingExtension {
  #inversifyBinding: InversifyBinding | undefined;
  #container: Container | undefined;
  #connectionManager: ConnectionManager | undefined;

  constructor(private extensionContext: api.ExtensionContext) {}

  protected getContainer(): Container | undefined {
    return this.#container;
  }

  async activate(): Promise<void> {
    console.log('Starting Docling extension...');

    const KAIDEN_CONTAINER_EXTENSION_ID = 'kaiden.container';
    const containerExtension = api.extensions.getExtension<ContainerExtensionAPI>(KAIDEN_CONTAINER_EXTENSION_ID);
    if (!containerExtension) {
      throw new Error(`Mandatory extension ${KAIDEN_CONTAINER_EXTENSION_ID} is not installed`);
    }
    const containerExtensionAPI = containerExtension?.exports;
    if (!containerExtensionAPI) {
      throw new Error(`Missing exports of API in container extension ${KAIDEN_CONTAINER_EXTENSION_ID}`);
    }

    const provider = api.provider.createProvider({
      id: 'docling',
      name: 'Docling',
      status: 'ready',
      emptyConnectionMarkdownDescription: 'Provides Docling-based document chunking for Knowledges',
      images: {
        icon: './icon.png',
        logo: {
          dark: './icon.png',
          light: './icon.png',
        },
      },
    });

    this.#inversifyBinding = new InversifyBinding(provider, containerExtensionAPI, this.extensionContext);
    this.#container = await this.#inversifyBinding.initBindings();
    this.#connectionManager = this.getContainer()?.get(ConnectionManager);
    await this.#connectionManager?.init();
  }

  async deactivate(): Promise<void> {
    this.#connectionManager?.dispose();
    await this.#inversifyBinding?.dispose();
  }
}
