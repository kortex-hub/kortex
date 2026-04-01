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

import { exec } from 'node:child_process';
import { existsSync } from 'node:fs';
import { chmod, mkdir, rm, unlink, writeFile } from 'node:fs/promises';
import { arch } from 'node:os';
import { join } from 'node:path';

import type {
  CliTool,
  Disposable,
  env as EnvAPI,
  ExtensionContext,
  QuickPickItem,
  window as WindowAPI,
} from '@kortex-app/api';
import type { components as OctokitComponents } from '@octokit/openapi-types';
import type { Octokit } from '@octokit/rest';
import { Open } from 'unzipper';

const GITHUB_ORG = 'kortex-hub';
const GITHUB_REPO = 'kortex-cli';

export interface ReleaseArtifactMetadata extends QuickPickItem {
  tag: string;
  id: number;
}

export class KortexCliDownloader implements Disposable {
  #installDirectory: string;

  constructor(
    private readonly extensionContext: ExtensionContext,
    private readonly octokit: Octokit,
    private readonly envAPI: typeof EnvAPI,
    private readonly windowAPI: typeof WindowAPI,
  ) {
    this.#installDirectory = join(this.extensionContext.storagePath, 'kortex-cli-package');
  }

  async init(): Promise<void> {
    if (!existsSync(this.#installDirectory)) {
      await mkdir(this.#installDirectory, { recursive: true });
    }
  }

  dispose(): void {}

  extractTarGz(filePath: string, outDir: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // eslint-disable-next-line sonarjs/os-command
      exec(`tar -xzf "${filePath}" -C "${outDir}"`, err => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async install(release: ReleaseArtifactMetadata): Promise<string> {
    const destFile = await this.download(release);

    if (destFile.endsWith('.zip')) {
      const directory = await Open.file(destFile);
      await directory.extract({ path: this.#installDirectory });
    } else if (destFile.endsWith('.tar.gz') && (this.envAPI.isMac || this.envAPI.isLinux)) {
      await this.extractTarGz(destFile, this.#installDirectory);
    } else {
      throw new Error(`Unsupported archive format: ${destFile}`);
    }

    await unlink(destFile);

    const executablePath = this.getKortexExecutablePath();
    if (!existsSync(executablePath)) {
      throw new Error(`Kortex CLI executable was not found after extraction: ${executablePath}`);
    }
    if (!this.envAPI.isWindows) {
      await chmod(executablePath, 0o755);
    }

    return executablePath;
  }

  async uninstall(): Promise<void> {
    if (existsSync(this.#installDirectory)) {
      await rm(this.#installDirectory, { recursive: true });
    }
  }

  getKortexExecutablePath(): string {
    const executable = this.envAPI.isWindows ? 'kortex-cli.exe' : 'kortex-cli';
    return join(this.#installDirectory, executable);
  }

  async selectVersion(cliInfo?: CliTool): Promise<ReleaseArtifactMetadata> {
    let releasesMetadata = await this.grabLatestReleasesMetadata();

    if (releasesMetadata.length === 0) throw new Error('cannot grab kortex-cli releases');

    if (cliInfo) {
      releasesMetadata = releasesMetadata.filter(release => release.tag.slice(1) !== cliInfo.version);
    }

    const selectedRelease = await this.windowAPI.showQuickPick(releasesMetadata, {
      placeHolder: 'Select Kortex CLI version to download',
    });

    if (!selectedRelease) {
      throw new Error('No version selected');
    }
    return selectedRelease;
  }

  async grabLatestReleasesMetadata(): Promise<ReleaseArtifactMetadata[]> {
    const lastReleases = await this.octokit.repos.listReleases({
      owner: GITHUB_ORG,
      repo: GITHUB_REPO,
      per_page: 10,
    });

    return lastReleases.data
      .filter(release => !release.prerelease)
      .map(release => ({
        label: release.name ?? release.tag_name,
        tag: release.tag_name,
        id: release.id,
      }))
      .slice(0, 5);
  }

  async getLatestVersionAsset(): Promise<ReleaseArtifactMetadata> {
    const latestReleases = await this.grabLatestReleasesMetadata();
    return latestReleases[0];
  }

  async getReleaseAssetId(releaseId: number): Promise<OctokitComponents['schemas']['release-asset']> {
    const architecture = arch();
    let assetName: string;

    if (this.envAPI.isWindows) {
      switch (architecture) {
        case 'x64':
          assetName = 'windows_amd64.zip';
          break;
        case 'arm64':
          assetName = 'windows_arm64.zip';
          break;
        default:
          throw new Error(`Unsupported architecture for Windows: ${architecture}`);
      }
    } else if (this.envAPI.isMac) {
      switch (architecture) {
        case 'arm64':
          assetName = 'darwin_arm64.tar.gz';
          break;
        case 'x64':
          assetName = 'darwin_amd64.tar.gz';
          break;
        default:
          throw new Error(`Unsupported architecture for macOS: ${architecture}`);
      }
    } else if (this.envAPI.isLinux) {
      switch (architecture) {
        case 'arm64':
          assetName = 'linux_arm64.tar.gz';
          break;
        case 'x64':
          assetName = 'linux_amd64.tar.gz';
          break;
        default:
          throw new Error(`Unsupported architecture for Linux: ${architecture}`);
      }
    } else {
      throw new Error('Unsupported platform');
    }

    const listOfAssets = await this.octokit.repos.listReleaseAssets({
      owner: GITHUB_ORG,
      repo: GITHUB_REPO,
      release_id: releaseId,
      per_page: 60,
    });

    const asset = listOfAssets.data.find(a => a.name.endsWith(assetName));
    if (!asset) {
      throw new Error(
        `No asset found for ${architecture} on ${this.envAPI.isWindows ? 'Windows' : this.envAPI.isMac ? 'macOS' : 'Linux'}`,
      );
    }

    return asset;
  }

  async download(release: ReleaseArtifactMetadata): Promise<string> {
    const asset = await this.getReleaseAssetId(release.id);

    const storageData = this.extensionContext.storagePath;
    if (!existsSync(storageData)) {
      await mkdir(storageData, { recursive: true });
    }

    const destination = join(storageData, asset.name);
    await this.downloadReleaseAsset(asset.id, destination);
    return destination;
  }

  protected async downloadReleaseAsset(assetId: number, destination: string): Promise<void> {
    const asset = await this.octokit.repos.getReleaseAsset({
      owner: GITHUB_ORG,
      repo: GITHUB_REPO,
      asset_id: assetId,
      headers: {
        accept: 'application/octet-stream',
      },
    });

    await writeFile(destination, Buffer.from(asset.data as unknown as ArrayBuffer));
  }
}
