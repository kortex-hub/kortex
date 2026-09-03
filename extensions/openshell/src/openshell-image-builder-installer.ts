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

import { downloadBinaries, getRelease, OPENSHELL_IMAGE_BUILDER_DOWNLOAD } from './openshell-download';

export class OpenshellImageBuilderInstaller implements CliToolInstaller {
  private selectedVersion: string | undefined;
  readonly #cliTool: CliTool;
  readonly #imageBuilderVersion: string;
  readonly #storagePath: string;

  constructor(cliTool: extensionApi.CliTool, imageBuilderVersion: string, storagePath: string) {
    this.#cliTool = cliTool;
    this.#imageBuilderVersion = imageBuilderVersion;
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
      throw new Error('openshell-image-builder install is not supported on this platform');
    }

    const version = this.selectedVersion ?? this.#imageBuilderVersion;
    const platform = extensionApi.env.isMac ? 'darwin' : 'linux';
    const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
    const binDir = join(this.#storagePath, 'bin');

    logger.log(`Installing openshell-image-builder ${version} for ${platform}/${arch}...`);

    try {
      const release = await getRelease(OPENSHELL_IMAGE_BUILDER_DOWNLOAD, version);
      await downloadBinaries(
        OPENSHELL_IMAGE_BUILDER_DOWNLOAD,
        release.version,
        platform,
        arch,
        binDir,
        release.digests,
      );
      logger.log('openshell-image-builder installation completed successfully');
      this.#cliTool.updateVersion({
        version: release.version,
        path: join(binDir, extensionApi.env.isWindows ? 'openshell-image-builder.exe' : 'openshell-image-builder'),
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`openshell-image-builder installation failed: ${message}`);
      throw error;
    }
  }

  async doUninstall(logger: Logger): Promise<void> {
    logger.log('Uninstalling openshell-image-builder...');

    try {
      if (extensionApi.env.isMac || extensionApi.env.isLinux) {
        const binaryName = 'openshell-image-builder';
        const binaryPath = join(this.#storagePath, 'bin', binaryName);
        await rm(binaryPath, { force: true });
      }
      logger.log('openshell-image-builder uninstalled successfully');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(`openshell-image-builder uninstall failed: ${message}`);
      throw error;
    }
  }

  private async fetchPinnedVersion(): Promise<string> {
    const release = await getRelease(OPENSHELL_IMAGE_BUILDER_DOWNLOAD, this.#imageBuilderVersion);
    return release.version;
  }
}
