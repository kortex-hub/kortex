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
import { cli, process, provider, env, window, version } from '@kortex-app/api';

import { GooseCLI } from './goose-cli';
import { GooseRecipe } from './goose-recipe';
import { GooseDownloader } from './goose-downloader';
import { Octokit } from '@octokit/rest';

export async function activate(extensionContext: ExtensionContext): Promise<void> {
  const octokit = new Octokit();
  const gooseDownloader = new GooseDownloader(extensionContext, octokit, env, window);
  extensionContext.subscriptions.push(gooseDownloader);

  const gooseCLI = new GooseCLI(cli, process, gooseDownloader);
  extensionContext.subscriptions.push(gooseCLI);
  await gooseCLI.init();

  const gooseProvider = new GooseRecipe(provider, gooseCLI, version);
  extensionContext.subscriptions.push(gooseProvider);
  gooseProvider.init();
}

export function deactivate(): void {}
