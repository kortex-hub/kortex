/**********************************************************************
 * Copyright (C) 2023-2025 Red Hat, Inc.
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

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { injectable } from 'inversify';

// handle the different directories for the different OSes for Podman Desktop
@injectable()
export class Directories {
  static readonly XDG_DATA_DIRECTORY = `.local${path.sep}share${path.sep}kortex`;

  public static readonly KORTEX_HOME_DIR = 'KORTEX_HOME_DIR';

  private configurationDirectory: string;
  private pluginsDirectory: string;
  private pluginsScanDirectory: string;
  private extensionsStorageDirectory: string;
  private contributionStorageDirectory: string;
  private safeStorageDirectory: string;
  protected desktopAppHomeDir: string;

  constructor() {
    // read ENV VAR to override the App Home Dir
    this.desktopAppHomeDir =
      process.env[Directories.KORTEX_HOME_DIR] ?? path.resolve(os.homedir(), Directories.XDG_DATA_DIRECTORY);

    // create the App Home Dir if it does not exist
    if (!fs.existsSync(this.desktopAppHomeDir)) {
      fs.mkdirSync(this.desktopAppHomeDir, { recursive: true });
    }
    this.configurationDirectory = path.resolve(this.desktopAppHomeDir, 'configuration');
    this.pluginsDirectory = path.resolve(this.desktopAppHomeDir, 'plugins');
    this.pluginsScanDirectory = path.resolve(this.desktopAppHomeDir, 'plugins-scanning');
    this.extensionsStorageDirectory = path.resolve(this.desktopAppHomeDir, 'extensions-storage');
    this.contributionStorageDirectory = path.resolve(this.desktopAppHomeDir, 'contributions');
    this.safeStorageDirectory = path.resolve(this.desktopAppHomeDir, 'safe-storage');
  }

  getConfigurationDirectory(): string {
    return this.configurationDirectory;
  }

  getPluginsDirectory(): string {
    return this.pluginsDirectory;
  }

  getPluginsScanDirectory(): string {
    return this.pluginsScanDirectory;
  }

  getExtensionsStorageDirectory(): string {
    return this.extensionsStorageDirectory;
  }

  public getContributionStorageDir(): string {
    return this.contributionStorageDirectory;
  }

  public getSafeStorageDirectory(): string {
    return this.safeStorageDirectory;
  }
}
