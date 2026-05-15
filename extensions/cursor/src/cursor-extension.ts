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
import { provider } from '@openkaiden/api';
import type { Container } from 'inversify';

import { InversifyBinding } from '/@/inject/inversify-binding';
import { CursorInferenceManager } from '/@/manager/cursor-inference-manager';

export class CursorExtension {
  #extensionContext: ExtensionContext;

  #inversifyBinding: InversifyBinding | undefined;
  #container: Container | undefined;
  #cursorInferenceManager: CursorInferenceManager | undefined;

  constructor(extensionContext: ExtensionContext) {
    this.#extensionContext = extensionContext;
  }

  async activate(): Promise<void> {
    const cursorProvider = provider.createProvider({
      name: 'Cursor',
      status: 'unknown',
      id: 'cursor',
      images: {
        icon: {
          dark: './APP_ICON_2D_DARK.png',
          light: './APP_ICON_2D_LIGHT.png',
        },
        logo: {
          dark: './APP_ICON_2D_DARK.png.png',
          light: './APP_ICON_2D_LIGHT.png',
        },
      },
    });

    this.#inversifyBinding = new InversifyBinding(cursorProvider, this.#extensionContext);
    this.#container = await this.#inversifyBinding.initBindings();

    try {
      this.#cursorInferenceManager = await this.getContainer()?.getAsync(CursorInferenceManager);
    } catch (e) {
      console.error('Error while creating the Cursor inference manager', e);
      throw e;
    }

    await this.#cursorInferenceManager?.init();
  }

  protected getContainer(): Container | undefined {
    return this.#container;
  }

  async deactivate(): Promise<void> {
    await this.#inversifyBinding?.dispose();
    this.#cursorInferenceManager?.dispose();
    this.#cursorInferenceManager = undefined;
  }
}
