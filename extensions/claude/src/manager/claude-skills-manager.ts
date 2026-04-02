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

import { homedir } from 'node:os';
import { join } from 'node:path';

import type { Disposable, Provider } from '@kortex-app/api';
import { inject, injectable } from 'inversify';

import { ClaudeProviderSymbol } from '/@/inject/symbol';

@injectable()
export class ClaudeSkillsManager {
  @inject(ClaudeProviderSymbol)
  private claudeProvider: Provider;

  #skillDisposable: Disposable | undefined;

  static getClaudeSkillsDir(): string {
    return join(homedir(), '.claude', 'skills');
  }

  async init(): Promise<void> {
    const claudeSkillsDir = ClaudeSkillsManager.getClaudeSkillsDir();

    this.#skillDisposable = this.claudeProvider.registerSkill({
      label: 'Claude',
      path: claudeSkillsDir,
    });
  }

  dispose(): void {
    this.#skillDisposable?.dispose();
    this.#skillDisposable = undefined;
  }
}
