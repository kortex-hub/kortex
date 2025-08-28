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
import { basename,dirname, join } from 'node:path';

import type {
  Disposable,
  Flow,
  FlowDeployKubernetesOptions,
  FlowDeployKubernetesResult,
  FlowGenerateOptions,
  Provider,
  provider as ProviderAPI,
  ProviderConnectionStatus,
} from '@kortex-app/api';
import { EventEmitter } from '@kortex-app/api';

import type { GooseCLI } from './goose-cli';
import { KubeTemplate } from './kube-template';
import { RecipeTemplate } from './recipe-template';

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
    // https://block.github.io/goose/docs/guides/recipes/storing-recipes
    return join(homedir(), '.config', 'goose', 'recipes');
  }

  protected async all(): Promise<Array<Flow>> {
    const basePath =  this.getBasePath();
    const recipes = await this.gooseCLI.getRecipes({
      path: basePath,
    });
    // map Recipe to Flow
    return recipes.map(({ path }) => {
      return {
        id: Buffer.from(path).toString('base64'),
        path,
      };
    });
  }

  protected async getFlowPath(flowId: string): Promise<string> {
    const decoded = Buffer.from(flowId, 'base64').toString('utf-8');
    if(dirname(decoded) !== this.getBasePath()) throw new Error(`only support recipes in ${this.getBasePath()}`);

    return decoded;
  }

  protected async read(flowId: string): Promise<string> {
    const path = await this.getFlowPath(flowId);
    return await readFile(path, 'utf-8');
  }

  protected async write(flowId: string, content: string): Promise<void> {
    throw new Error('not implemented');
  }

  protected async generate(options: FlowGenerateOptions): Promise<string> {
    return new RecipeTemplate({
      recipe: {
        name: options.name,
        title: options.name,
        prompt: options.prompt,
        instructions: options.prompt
      },
    }).render();
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
        read: this.read.bind(this),
        write: this.write.bind(this),
        generate: this.generate.bind(this),
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
    const path = await this.getFlowPath(options.flowId);

    const content = await readFile(path, 'utf-8');

    const recipeName = basename(path).split('.')[0];

    const token = options.connection.credentials()['gemini:tokens'] ?? 'API_TOKEN';

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
              value: (options.hideSecrets) ? ('*'.repeat(token.length)) : token,
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
