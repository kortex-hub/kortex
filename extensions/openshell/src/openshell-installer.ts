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
 **********************************************************************/

import { rm } from 'node:fs/promises';
import { join } from 'node:path';

import type { CliTool, CliToolInstaller, Logger } from '@openkaiden/api';
import * as extensionApi from '@openkaiden/api';

import { downloadBinaries, getRelease, OPENSHELL_DOWNLOAD } from './openshell-download';

export class OpenshellInstaller implements CliToolInstaller {
  private selectedVersion: string | undefined;
  readonly #cliTool: CliTool;
  readonly #openshellVersion: string;
  readonly #storagePath: string;

  constructor(cliTool: extensionApi.CliTool, openshellVersion: string, storagePath: string) {
    this.#cliTool = cliTool;
    this.#openshellVersion = openshellVersion;
    this.#storagePath = storagePath;
  }

  async selectVersion(latest?: boolean): Promise<string> {
    if (latest || !this.selectedVersion) {
      this.selectedVersion = await this.fetchPinnedVersion();
    }
    return this.selectedVersion;
  }

  async doInstall(logger: Logger): Promise<void> {
    if (!extensionApi.env.isMac && !extensionApi.env.isLinux) {
      throw new Error('OpenShell install is not supported on this platform');
    }

    const version = this.selectedVersion ?? this.#openshellVersion;
    const platform = extensionApi.env.isMac ? 'darwin' : 'linux';
    const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
    const binDir = join(this.#storagePath, 'bin');

    logger.log(`Installing OpenShell ${version} for ${platform}/${arch}...`);

    try {
      const release = await getRelease(OPENSHELL_DOWNLOAD, version);
      await downloadBinaries(OPENSHELL_DOWNLOAD, release.version, platform, arch, binDir, release.digests);
      logger.log('OpenShell installation completed successfully');
      this.#cliTool.updateVersion({
        version: release.version,
        path: join(binDir, extensionApi.env.isWindows ? 'openshell.exe' : 'openshell'),
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`OpenShell installation failed: ${message}`);
      throw error;
    }
  }

  async doUninstall(logger: Logger): Promise<void> {
    logger.log('Uninstalling OpenShell...');

    try {
      if (extensionApi.env.isMac || extensionApi.env.isLinux) {
        const binDir = join(this.#storagePath, 'bin');
        await rm(binDir, { recursive: true, force: true });
      }
      logger.log('OpenShell uninstalled successfully');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`OpenShell uninstall failed: ${message}`);
      throw error;
    }
  }

  private async fetchPinnedVersion(): Promise<string> {
    const release = await getRelease(OPENSHELL_DOWNLOAD, this.#openshellVersion);
    return release.version;
  }
}
