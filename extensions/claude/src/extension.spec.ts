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

import type { Dirent } from 'node:fs';
import { existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { skills } from '@kortex-app/api';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { ClaudeExtension } from './claude-extension';

vi.mock(import('node:fs'));
vi.mock(import('node:fs/promises'));
vi.mock(import('node:os'));
vi.mock(import('@kortex-app/api'));

const MOCK_HOME = '/home/testuser';
const CLAUDE_SKILLS_DIR = join(MOCK_HOME, '.claude', 'skills');

function createDirent(name: string, isDir: boolean): Dirent<Buffer<ArrayBufferLike>> {
  return {
    name,
    isDirectory: () => isDir,
    isFile: () => !isDir,
    parentPath: CLAUDE_SKILLS_DIR,
  } as unknown as Dirent<Buffer<ArrayBufferLike>>;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(homedir).mockReturnValue(MOCK_HOME);
  vi.mocked(existsSync).mockReturnValue(true);
});

describe('ClaudeExtension', () => {
  test('does nothing when .claude/skills directory does not exist', async () => {
    vi.mocked(existsSync).mockReturnValue(false);

    const ext = new ClaudeExtension();
    await ext.init();

    expect(readdir).not.toHaveBeenCalled();
    expect(skills.registerSkill).not.toHaveBeenCalled();
  });

  test('registers skills from subdirectories containing SKILL.md', async () => {
    vi.mocked(readdir).mockResolvedValue([createDirent('my-skill', true), createDirent('other-skill', true)]);

    vi.mocked(skills.registerSkill).mockResolvedValue(undefined);

    const ext = new ClaudeExtension();
    await ext.init();

    expect(skills.registerSkill).toHaveBeenCalledTimes(2);
    expect(skills.registerSkill).toHaveBeenCalledWith(join(CLAUDE_SKILLS_DIR, 'my-skill'));
    expect(skills.registerSkill).toHaveBeenCalledWith(join(CLAUDE_SKILLS_DIR, 'other-skill'));
  });

  test.each([
    { description: 'non-directory entry', entry: createDirent('readme.txt', false) },
    { description: 'directory without SKILL.md', entry: createDirent('no-skill-file', true) },
  ])('skips $description', async ({ entry }) => {
    vi.mocked(existsSync).mockReturnValueOnce(true).mockReturnValue(false);
    vi.mocked(readdir).mockResolvedValue([entry]);

    const ext = new ClaudeExtension();
    await ext.init();

    expect(skills.registerSkill).not.toHaveBeenCalled();
  });

  test('continues registering skills when one fails', async () => {
    vi.mocked(readdir).mockResolvedValue([createDirent('bad-skill', true), createDirent('good-skill', true)]);

    vi.mocked(skills.registerSkill).mockRejectedValueOnce(new Error('invalid skill')).mockResolvedValueOnce(undefined);

    const ext = new ClaudeExtension();
    await ext.init();

    expect(skills.registerSkill).toHaveBeenCalledTimes(2);
  });
});
