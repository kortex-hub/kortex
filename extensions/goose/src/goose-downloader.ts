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

import { exec } from 'node:child_process';
import { existsSync, unlinkSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
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

const GITHUB_ORG = 'block';
const GITHUB_REPO = 'goose';

export interface ReleaseArtifactMetadata extends QuickPickItem {
  tag: string;
  id: number;
}

export class GooseDownloader implements Disposable {
  #installDirectory: string;

  constructor(
    private readonly extensionContext: ExtensionContext,
    private readonly octokit: Octokit,
    private readonly envAPI: typeof EnvAPI,
    private readonly windowAPI: typeof WindowAPI,
  ) {
    this.#installDirectory = join(this.extensionContext.storagePath, 'goose-package');
  }

  async init(): Promise<void> {
    // ensure the install directory exists
    if (!existsSync(this.#installDirectory)) {
      await mkdir(this.#installDirectory, { recursive: true });
    }
  }

  dispose(): void {}

  extractTarBz2(filePath: string, outDir: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // eslint-disable-next-line sonarjs/os-command
      exec(`tar -xjf "${filePath}" -C "${outDir}"`, err => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  async install(release: ReleaseArtifactMetadata): Promise<string> {
    const destFile = await this.download(release);

    if (destFile.endsWith('.zip')) {
      const directory = await Open.file(destFile);
      await directory.extract({ path: this.extensionContext.storagePath });
    } else if (destFile.endsWith('.tar.bz2') && (this.envAPI.isMac || this.envAPI.isLinux)) {
      // use tar xjf to extract .tar.bz2 files
      await this.extractTarBz2(destFile, this.#installDirectory);
    } else {
      throw new Error(`Unsupported archive format: ${destFile}`);
    }

    unlinkSync(destFile);
    return this.getGooseExecutableExtensionStorage();
  }

  getGooseExecutableExtensionStorage(): string {
    const executable: string = this.envAPI.isWindows ? 'goose.exe' : 'goose';
    return join(this.#installDirectory, executable);
  }

  async selectVersion(cliInfo?: CliTool): Promise<ReleaseArtifactMetadata> {
    let releasesMetadata = await this.grabLatestsReleasesMetadata();

    if (releasesMetadata.length === 0) throw new Error('cannot grab minikube releases');

    // if the user already has an installed version, we remove it from the list
    if (cliInfo) {
      releasesMetadata = releasesMetadata.filter(release => release.tag.slice(1) !== cliInfo.version);
    }

    // Show the quickpick
    const selectedRelease = await this.windowAPI.showQuickPick(releasesMetadata, {
      placeHolder: 'Select Kind version to download',
    });

    if (!selectedRelease) {
      throw new Error('No version selected');
    }
    return selectedRelease;
  }

  // Provides last 5 majors releases from GitHub using the GitHub API
  // return name, tag and id of the release
  async grabLatestsReleasesMetadata(): Promise<ReleaseArtifactMetadata[]> {
    // Grab last 5 majors releases from GitHub using the GitHub API
    const lastReleases = await this.octokit.repos.listReleases({
      owner: GITHUB_ORG,
      repo: GITHUB_REPO,
      per_page: 10,
    });

    return lastReleases.data
      .filter(release => !release.prerelease)
      .map(release => {
        return {
          label: release.name ?? release.tag_name,
          tag: release.tag_name,
          id: release.id,
        };
      })
      .slice(0, 5);
  }

  async getLatestVersionAsset(): Promise<ReleaseArtifactMetadata> {
    const latestReleases = await this.grabLatestsReleasesMetadata();
    return latestReleases[0];
  }

  async getReleaseAssetId(releaseId: number): Promise<OctokitComponents['schemas']['release-asset']> {
    let assetName: string | undefined = undefined;

    const architecture = arch();
    if (this.envAPI.isWindows) {
      switch (architecture) {
        case 'x64':
          assetName = 'goose-x86_64-pc-windows-gnu.zip';
          break;
        default:
          throw new Error(`Unsupported architecture for windows: ${architecture}`);
      }
    } else if (this.envAPI.isMac) {
      switch (architecture) {
        case 'arm64':
          assetName = 'goose-aarch64-apple-darwin.tar.bz2';
          break;
        case 'x64':
          assetName = 'goose-x86_64-apple-darwin.tar.bz2';
          break;
        default:
          throw new Error(`Unsupported architecture for mac: ${architecture}`);
      }
    } else if (this.envAPI.isLinux) {
      switch (architecture) {
        case 'x64':
          assetName = 'goose-x86_64-unknown-linux-gnu.tar.bz2';
          break;
        default:
          throw new Error(`Unsupported architecture for linux: ${architecture}`);
      }
    }

    const listOfAssets = await this.octokit.repos.listReleaseAssets({
      owner: GITHUB_ORG,
      repo: GITHUB_REPO,
      release_id: releaseId,
      per_page: 60,
    });

    // search for the right asset
    const asset = listOfAssets.data.find(asset => assetName === asset.name);
    if (!asset) {
      throw new Error(`No asset found for ${arch}`);
    }

    return asset;
  }

  // return the path where the file has been downloaded
  async download(release: ReleaseArtifactMetadata): Promise<string> {
    // Get asset id
    const asset = await this.getReleaseAssetId(release.id);

    // Get the storage and check to see if it exists before we download kubectl
    const storageData = this.extensionContext.storagePath;
    if (!existsSync(storageData)) {
      await mkdir(storageData, { recursive: true });
    }

    const destination = join(storageData, asset.name);

    // Download the asset and make it executable
    await this.downloadReleaseAsset(asset.id, destination);

    return destination;
  }

  // download the given asset id
  protected async downloadReleaseAsset(assetId: number, destination: string): Promise<void> {
    const asset = await this.octokit.repos.getReleaseAsset({
      owner: GITHUB_ORG,
      repo: GITHUB_REPO,
      asset_id: assetId,
      headers: {
        accept: 'application/octet-stream',
      },
    });

    // write the file
    await writeFile(destination, Buffer.from(asset.data as unknown as ArrayBuffer));
  }
}
