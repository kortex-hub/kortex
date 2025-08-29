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
import { spawn } from 'node:child_process';

import type { cli as CliAPI, CliTool, Disposable, Logger, process as ProcessAPI } from '@kortex-app/api';
import { env } from '@kortex-app/api';

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
  get installed(): boolean {
    return !!this.cli?.version;
  }

  async getGooseFullPath(): Promise<string | undefined> {
    const cmd = 'goose';
    if (env.isWindows) {
      return `${cmd}.exe`;
    }
    try {
      const { stdout } = await this.processAPI.exec('which', ['goose']);
      return stdout.trim();
    } catch (err: unknown) {
      return undefined;
    }
  }

  async run(flowPath: string, logger: Logger, options: { path: string }): Promise<void> {
    const deferred = Promise.withResolvers<void>();

    const cmdPath = await this.getGooseFullPath();
    if (!cmdPath) {
      deferred.reject(new Error('goose command not found'));
      return deferred.promise;
    }
    // run goose flow execute <flowId> --watch
    const subprocess = spawn(cmdPath, ['run', '--recipe', flowPath], {
      env: { GOOSE_RECIPE_PATH: options.path },
    });

    subprocess.stdout.on('data', data => {
      logger.log(data.toString());
    });

    subprocess.stderr.on('data', data => {
      logger.error(data.toString());
    });

    subprocess.on('exit', code => {
      if (code === 0) {
        deferred.resolve();
      } else {
        deferred.reject(new Error(`goose process exited with code ${code}`));
      }
    });

    return deferred.promise;
  }

  async getRecipes(options: { path: string }): Promise<Array<{ path: string }>> {
    // skip when no
    if (!this.installed) {
      console.warn('cannot get recipes: goose is not installed');
      return [];
    }

    try {
      const { stdout } = await this.processAPI.exec('goose', ['recipe', 'list', '--format=json'], {
        env: { GOOSE_RECIPE_PATH: options.path },
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
