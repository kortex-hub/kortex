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
import { homedir } from 'node:os';
import { join } from 'node:path';

import type {
  Disposable,
Flow,  Provider,
  provider as ProviderAPI,
  ProviderConnectionStatus} from '@kortex-app/api';
import {
  EventEmitter,
} from '@kortex-app/api';

import type { GooseCLI } from './goose-cli';

export class GooseRecipe implements Disposable {
  private gooseProvider: Provider | undefined = undefined;
  private readonly updateEmitter: EventEmitter<void> = new EventEmitter();
  private connection: Disposable | undefined = undefined;

  constructor(
    private readonly provider: typeof ProviderAPI,
    private readonly gooseCLI: GooseCLI,
    ) {
  }

  protected async all(): Promise<Array<Flow>> {
    return this.gooseCLI.getRecipes({
      path: join(homedir(), '.config', 'goose', 'recipes'),
    });
  }

  init(): void {
    this.gooseProvider = this.provider.createProvider({
      id: 'goose',
      name: 'goose',
      status: 'unknown',
    });

    this.connection = this.gooseProvider?.registerFlowProviderConnection({
      name: 'goose-recipes',
      flow: {
        all: this.all.bind(this),
        onDidChange: this.updateEmitter.event,
      },
      lifecycle: {},
      status(): ProviderConnectionStatus {
        return 'unknown';
      },
    });
  }

  dispose(): void {
    this.gooseProvider?.dispose();
    this.connection?.dispose();
    this.updateEmitter.dispose();
  }
}
