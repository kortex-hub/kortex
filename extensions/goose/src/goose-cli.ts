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
import type { cli as CliAPI, CliTool, Disposable, process as ProcessAPI } from '@kortex-app/api';

export class GooseCLI implements Disposable {
  private cli: CliTool | undefined = undefined;

  constructor(
    private readonly cliAPI: typeof CliAPI,
    private readonly processAPI: typeof ProcessAPI,
  ) {}

  protected async findGooseVersion(): Promise<string | undefined> {
    try {
      const { stdout } = await this.processAPI.exec('goose', ['--version']);
      return stdout.trim();
    } catch (err: unknown) {
      return undefined;
    }
  }

  async getRecipes(options: { path: string }): Promise<Array<{ path: string }>> {
    // skip when no
    if (this.cli?.version === undefined) {
      console.warn('cannot get recipes: goose is not installed');
      return [];
    }

    try {
      const { stdout } = await this.processAPI.exec('goose', ['recipe', 'list', '--format=json'], {
        env: {GOOSE_RECIPE_PATH: options.path},
      });
      console.log('[GooseCLI] getRecipes: ', stdout);
      return JSON.parse(stdout);
    } catch (err: unknown) {
      console.error('[GooseCLI] something went wrong', err);
      return [];
    }
  }

  async init(): Promise<void> {
    const version = await this.findGooseVersion();

    this.cli = this.cliAPI.createCliTool({
      name: 'goose',
      displayName: 'Goose',
      markdownDescription: 'Goose CLI',
      images: {},
      version: version,
    });
  }

  dispose(): void {
    this.cli?.dispose();
  }
}
