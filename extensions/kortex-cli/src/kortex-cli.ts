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

import { existsSync } from 'node:fs';

import type {
  cli as CliAPI,
  CliTool,
  CliToolInstallationSource,
  Disposable,
  env as EnvAPI,
  process as ProcessAPI,
} from '@kortex-app/api';

import type { KortexCliDownloader, ReleaseArtifactMetadata } from './kortex-cli-downloader';
import { whereBinary } from './utils/system';

export const KORTEX_CLI_NAME = 'kortex-cli';

export class KortexCLI implements Disposable {
  private cli: CliTool | undefined = undefined;

  constructor(
    private readonly cliAPI: typeof CliAPI,
    private readonly processAPI: typeof ProcessAPI,
    private readonly downloader: KortexCliDownloader,
    private readonly envAPI: typeof EnvAPI,
  ) {}

  protected async findKortexVersion(): Promise<
    { path: string; version: string; installationSource: CliToolInstallationSource } | undefined
  > {
    // Check extension storage first
    try {
      const path = this.downloader.getKortexExecutablePath();
      if (existsSync(path)) {
        const { stdout } = await this.processAPI.exec(path, ['version']);
        return {
          path,
          version: this.parseVersion(stdout),
          installationSource: 'extension',
        };
      }
    } catch (err: unknown) {
      console.warn(err);
    }

    // Check system PATH
    const executable = this.envAPI.isWindows ? 'kortex-cli.exe' : 'kortex-cli';
    try {
      const { stdout } = await this.processAPI.exec(executable, ['version']);
      const location = await whereBinary(this.envAPI, this.processAPI, executable);
      return {
        path: location,
        version: this.parseVersion(stdout),
        installationSource: 'external',
      };
    } catch (err: unknown) {
      return undefined;
    }
  }

  // Parse version from "kortex-cli version X.Y.Z" output
  protected parseVersion(stdout: string): string {
    const parts = stdout.trim().split(' ');
    return parts[parts.length - 1];
  }

  async init(): Promise<void> {
    const info = await this.findKortexVersion();

    this.cli = this.cliAPI.createCliTool({
      name: KORTEX_CLI_NAME,
      displayName: 'Kortex CLI',
      markdownDescription: 'CLI for managing Kortex workspaces',
      images: {},
      version: info?.version,
      path: info?.path,
      installationSource: info?.installationSource,
    });

    if (!this.cli.version) {
      let artifact: ReleaseArtifactMetadata | undefined;

      this.cli.registerInstaller({
        selectVersion: async () => {
          const release = await this.downloader.selectVersion(this.cli);
          artifact = release;
          return release.tag.replace('v', '').trim();
        },
        doInstall: async () => {
          if (!artifact) throw new Error('No version selected');
          const installPath = await this.downloader.install(artifact);
          this.cli?.updateVersion({
            version: artifact.tag.replace('v', '').trim(),
            path: installPath,
          });
        },
        doUninstall: async () => {
          await this.downloader.uninstall();
          this.cli?.updateVersion({
            version: undefined,
            path: undefined,
          });
        },
      });
    }
  }

  dispose(): void {
    this.cli?.dispose();
  }
}
