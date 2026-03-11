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

import type { Disposable, ExtensionContext } from '@kortex-app/api';
import * as extensionApi from '@kortex-app/api';

export class ClaudeExtension implements Disposable {
  constructor(private readonly extensionContext: ExtensionContext) {}

  static getClaudeSkillsDir(): string {
    return join(homedir(), '.claude', 'skills');
  }

  async init(): Promise<void> {
    const claudeSkillsDir = ClaudeExtension.getClaudeSkillsDir();

    const targetDisposable = extensionApi.skills.registerSkillFolder({
      label: 'Claude Skills',
      badge: 'Claude',
      icon: './icon.png',
      baseDirectory: claudeSkillsDir,
    });
    this.extensionContext.subscriptions.push(targetDisposable);
  }

  dispose(): void {
    // Subscriptions are disposed by the extension loader on deactivation
  }
}
