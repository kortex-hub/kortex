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
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { ClaudeExtension } from './claude-extension';

vi.mock(import('node:os'));
vi.mock(import('@kortex-app/api'));

const MOCK_HOME = '/home/testuser';
const CLAUDE_SKILLS_DIR = join(MOCK_HOME, '.claude', 'skills');

function createMockExtensionContext(): ExtensionContext {
  return {
    subscriptions: [],
  } as unknown as ExtensionContext;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(homedir).mockReturnValue(MOCK_HOME);
});

describe('ClaudeExtension', () => {
  test('getClaudeSkillsDir returns expected path', () => {
    expect(ClaudeExtension.getClaudeSkillsDir()).toBe(CLAUDE_SKILLS_DIR);
  });

  test('registers skill folder with correct parameters', async () => {
    const mockDisposable: Disposable = { dispose: vi.fn() };
    vi.mocked(extensionApi.skills.registerSkillFolder).mockReturnValue(mockDisposable);

    const context = createMockExtensionContext();
    const ext = new ClaudeExtension(context);
    await ext.init();

    expect(extensionApi.skills.registerSkillFolder).toHaveBeenCalledWith({
      label: 'Claude Skills',
      badge: 'Claude',
      icon: './icon.png',
      baseDirectory: CLAUDE_SKILLS_DIR,
    });
  });

  test('pushes disposable to extension context subscriptions', async () => {
    const mockDisposable: Disposable = { dispose: vi.fn() };
    vi.mocked(extensionApi.skills.registerSkillFolder).mockReturnValue(mockDisposable);

    const context = createMockExtensionContext();
    const ext = new ClaudeExtension(context);
    await ext.init();

    expect(context.subscriptions).toContain(mockDisposable);
  });
});
