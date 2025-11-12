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
import { existsSync } from 'node:fs';

import type {
  cli as CliAPI,
  CliTool,
  CliToolInstallationSource,
  Disposable,
  env as EnvAPI,
  FlowGenerateCommandLineResult,
  Logger,
  process as ProcessAPI,
} from '@kortex-app/api';
import { EventEmitter } from '@kortex-app/api';

import type { GooseDownloader, ReleaseArtifactMetadata } from './goose-downloader';
import { whereBinary } from './utils/system';

export const GOOSE_CLI_NAME = 'goose';

export class GooseCLI implements Disposable {
  private cli: CliTool | undefined = undefined;
  private readonly eventEmitter: EventEmitter<'uninstall' | 'update'> = new EventEmitter();
  public readonly event = this.eventEmitter.event;

  constructor(
    private readonly cliAPI: typeof CliAPI,
    private readonly processAPI: typeof ProcessAPI,
    private readonly downloader: GooseDownloader,
    private readonly envAPI: typeof EnvAPI,
  ) {}

  protected async findGooseVersion(): Promise<
    { path: string; version: string; installationSource: CliToolInstallationSource } | undefined
  > {
    try {
      const path = this.downloader.getGooseExecutableExtensionStorage();
      if (existsSync(path)) {
        const { stdout } = await this.processAPI.exec(path, ['--version']);
        return {
          path: path,
          version: stdout.trim(),
          installationSource: 'extension',
        };
      }
    } catch (err: unknown) {
      console.warn(err);
    }

    const executable: string = this.envAPI.isWindows ? 'goose.exe' : 'goose';

    try {
      const { stdout } = await this.processAPI.exec(executable, ['--version']);
      const location = await whereBinary(this.envAPI, this.processAPI, executable);
      return {
        path: location,
        version: stdout.trim(),
        installationSource: 'external',
      };
    } catch (err: unknown) {
      return undefined;
    }
  }

  public isInstalled(): boolean {
    return !!this.cli?.version;
  }

  generateCommandLine(
    flowPath: string,
    options: { path: string; env?: Record<string, string>; params?: Record<string, string> },
  ): FlowGenerateCommandLineResult {
    if (!this.cli?.path) throw new Error('goose not installed');
    const args = [
      'run',
      '--recipe',
      flowPath,
      ...(options.params
        ? Object.entries(options.params).flatMap(([key, value]) => ['--params', `${key}=${value}`])
        : []),
    ];
    return {
      command: this.cli.path,
      args,
      env: { GOOSE_RECIPE_PATH: options.path, ...options.env },
    };
  }

  async run(
    flowPath: string,
    logger: Logger,
    options: { path: string; env?: Record<string, string>; params?: Record<string, string> },
  ): Promise<void> {
    const deferred = Promise.withResolvers<void>();

    const commandLine = this.generateCommandLine(flowPath, options);

    // run goose flow execute <flowId> --watch
    const subprocess = spawn(commandLine.command, commandLine.args, {
      env: commandLine.env,
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
    if (!this.cli?.path) throw new Error('goose not installed');

    // skip when no
    if (!this.isInstalled()) {
      console.warn('cannot get recipes: goose is not installed');
      return [];
    }

    try {
      const { stdout } = await this.processAPI.exec(this.cli?.path, ['recipe', 'list', '--format=json'], {
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
    const info = await this.findGooseVersion();

    this.cli = this.cliAPI.createCliTool({
      name: GOOSE_CLI_NAME,
      displayName: 'Goose',
      markdownDescription: 'Goose CLI',
      images: {},
      version: info?.version,
      path: info?.path,
      installationSource: info?.installationSource,
    });

    this.cli.onDidUpdateVersion(() => {
      this.eventEmitter.fire('update');
    });
    this.cli.onDidUninstall(() => {
      this.eventEmitter.fire('uninstall');
    });

    if (!this.cli.version) {
      // register the minikube installer
      let artifact: ReleaseArtifactMetadata | undefined;

      this.cli.registerInstaller({
        selectVersion: async () => {
          const release = await this.downloader.selectVersion(this.cli);
          artifact = release;
          return release.tag.replace('v', '').trim();
        },
        doInstall: async () => {
          if (!artifact) throw new Error('not selected');
          const installPath = await this.downloader.install(artifact);
          this.cli?.updateVersion({
            version: artifact.tag.replace('v', '').trim(),
            path: installPath,
          });
        },
        doUninstall: () => {
          throw new Error('not implemented');
        },
      });
    }
  }

  dispose(): void {
    this.cli?.dispose();
  }
}
