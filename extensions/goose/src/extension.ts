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

import type { ExtensionContext } from '@kortex-app/api';
import { cli, env, process as processAPI, provider, version, window } from '@kortex-app/api';
import type { OctokitOptions } from '@octokit/core';
import { Octokit } from '@octokit/rest';

import { GooseCLI } from './goose-cli';
import { GooseDownloader } from './goose-downloader';
import { GooseRecipe } from './goose-recipe';

export async function activate(extensionContext: ExtensionContext): Promise<void> {
  const octokitOptions: OctokitOptions = {};
  if (process.env.GITHUB_TOKEN) {
    octokitOptions.auth = process.env.GITHUB_TOKEN;
  }
  const octokit = new Octokit(octokitOptions);
  const gooseDownloader = new GooseDownloader(extensionContext, octokit, env, window);
  await gooseDownloader.init();
  extensionContext.subscriptions.push(gooseDownloader);

  const gooseCLI = new GooseCLI(cli, processAPI, gooseDownloader, env);
  extensionContext.subscriptions.push(gooseCLI);
  await gooseCLI.init();

  const gooseProvider = new GooseRecipe(provider, gooseCLI, version);
  extensionContext.subscriptions.push(gooseProvider);
  gooseProvider.init();
}

export function deactivate(): void {}
