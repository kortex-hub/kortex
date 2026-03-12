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
import { readdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

import type { Disposable } from '@kortex-app/api';
import * as extensionApi from '@kortex-app/api';

const SKILL_FILE_NAME = 'SKILL.md';

export class ClaudeExtension implements Disposable {
  static getClaudeSkillsDir(): string {
    return join(homedir(), '.claude', 'skills');
  }

  async init(): Promise<void> {
    const claudeSkillsDir = ClaudeExtension.getClaudeSkillsDir();

    if (!existsSync(claudeSkillsDir)) {
      console.log(`Claude skills directory not found at ${claudeSkillsDir}, skipping skill registration`);
      return;
    }

    const entries = await readdir(claudeSkillsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const skillPath = join(claudeSkillsDir, entry.name);
      const skillFile = join(skillPath, SKILL_FILE_NAME);

      if (!existsSync(skillFile)) {
        console.warn(`[claude] Skipping ${entry.name}: no ${SKILL_FILE_NAME} found`);
        continue;
      }

      try {
        await extensionApi.skills.registerSkill(skillPath);
        console.log(`[claude] Registered skill from ${skillPath}`);
      } catch (error: unknown) {
        console.warn(`[claude] Failed to register skill at ${skillPath}: ${error}`);
      }
    }
  }

  dispose(): void {
    // Skills are automatically unregistered by the extension loader on deactivation
  }
}
