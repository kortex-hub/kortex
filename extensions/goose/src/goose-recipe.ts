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
import { readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, dirname, join } from 'node:path';

import type {
  Disposable,
  Flow,
  FlowGenerateKubernetesOptions,
  FlowGenerateKubernetesResult,
  FlowGenerateOptions,
  Logger,
  Provider,
  provider as ProviderAPI,
  ProviderConnectionStatus,
} from '@kortex-app/api';
import { EventEmitter } from '@kortex-app/api';
import { parse } from 'yaml';

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
    const basePath = this.getBasePath();
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
    if (dirname(decoded) !== this.getBasePath()) throw new Error(`only support recipes in ${this.getBasePath()}`);

    return decoded;
  }

  protected async read(flowId: string): Promise<string> {
    const path = await this.getFlowPath(flowId);
    return await readFile(path, 'utf-8');
  }

  protected async create(content: string): Promise<string> {
    const parsed = parse(content);
    const name = parsed['name'].toLowerCase();

    const basePath = this.getBasePath();
    const fullPath = join(basePath, `${name}.yaml`);
    await writeFile(fullPath, content);

    // notify update
    this.updateEmitter.fire();

    return Buffer.from(fullPath).toString('base64');
  }

  protected async execute(flowId: string, logger: Logger): Promise<void> {
    // execute goose recipe using run
    const flowPath = await this.getFlowPath(flowId);
    await this.gooseCLI.run(flowPath, logger, { path: this.getBasePath() });
  }

  protected async generate(options: FlowGenerateOptions): Promise<string> {
    const gooseProviderMap = {
      gemini: 'google',
    };

    if (!(options.model.providerId in gooseProviderMap)) {
      throw Error(`[goose-recipe:generate]: cannot find goose provider for ${options.model.providerId}`);
    }

    const gooseProvider = gooseProviderMap[options.model.providerId as keyof typeof gooseProviderMap];
    return new RecipeTemplate({
      recipe: {
        name: options.name,
        title: options.name,
        prompt: options.prompt,
        instructions: options.instruction,
        settings: {
          goose_provider: gooseProvider,
          goose_model: options.model.label,
        },
        extensions: options.mcp.map(server => ({
          ...server,
          headers: Object.entries(server.headers ?? {}).map(([key, value]) => ({
            key: key,
            value: value,
          })),
        })),
      },
    }).render();
  }

  init(): void {
    this.gooseProvider = this.provider.createProvider({
      id: 'goose',
      name: 'goose',
      status: 'unknown',
      emptyConnectionMarkdownDescription:
        'Provides support of running recipes with prompts. See the [Goose documentation](https://block.github.io/goose/docs/getting-started/installation) for more information.',
      images: {
        icon: './icon.png',
        logo: {
          dark: './icon.png',
          light: './icon.png',
        },
      },
    });

    this.connection = this.gooseProvider.registerFlowProviderConnection({
      name: 'goose-recipes',
      flow: {
        all: this.all.bind(this),
        installed: this.gooseCLI.installed,
        onDidChange: this.updateEmitter.event,
        read: this.read.bind(this),
        create: this.create.bind(this),
        execute: this.execute.bind(this),
        generate: this.generate.bind(this),
        generateKubernetesYAML: this.deployKubernetes.bind(this),
      },
      lifecycle: {},
      status(): ProviderConnectionStatus {
        return 'unknown';
      },
    });
  }

  protected async deployKubernetes(options: FlowGenerateKubernetesOptions): Promise<FlowGenerateKubernetesResult> {
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
              value: options.hideSecrets ? '*'.repeat(token.length) : token,
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
