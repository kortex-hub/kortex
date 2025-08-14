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
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, basename } from 'node:path';

import type {
  Disposable,
  Flow,
  FlowDeployKubernetesOptions,
  FlowDeployKubernetesResult,
  Provider,
  provider as ProviderAPI,
  ProviderConnectionStatus,
} from '@kortex-app/api';
import { EventEmitter } from '@kortex-app/api';

import type { GooseCLI } from './goose-cli';
import { KubeTemplate } from './kube-template';

export class GooseRecipe implements Disposable {
  private gooseProvider: Provider | undefined = undefined;
  private readonly updateEmitter: EventEmitter<void> = new EventEmitter();
  private connection: Disposable | undefined = undefined;

  constructor(
    private readonly provider: typeof ProviderAPI,
    private readonly gooseCLI: GooseCLI,
    private readonly kortexVersion: string,
  ) {}

  protected getBasePath(): string {
    return join(homedir(), '.config', 'goose', 'recipes');
  }

  protected async all(): Promise<Array<Flow>> {
    return this.gooseCLI.getRecipes({
      path: this.getBasePath(),
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
      deploy: {
        kubernetes: this.deployKubernetes.bind(this),
      },
    });
  }

  protected async deployKubernetes(options: FlowDeployKubernetesOptions): Promise<FlowDeployKubernetesResult> {
    if (options.provider.id !== 'gemini') throw new Error('unsupported provider');

    const path = join(this.getBasePath(), options.flow.path);
    const content = await readFile(path, 'utf-8');

    const recipeName = basename(path).split('.')[0];

    const template = new KubeTemplate({
      kortex: {
        version: this.kortexVersion,
      },
      recipe: {
        name: recipeName,
        content: content,
      },
      provider: {
        name: options.provider.id,
        model: options.model.label,
        credentials: {
          env: [
            {
              key: 'GOOGLE_API_KEY',
              value: 'REPLACE_KEY_HERE',
            },
          ],
        },
      },
      namespace: options.namespace,
    });
    return {
      resources: template.render(),
    };
  }

  dispose(): void {
    this.gooseProvider?.dispose();
    this.connection?.dispose();
    this.updateEmitter.dispose();
  }
}
