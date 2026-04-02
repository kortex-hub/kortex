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
import { Container } from 'inversify';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { ExtensionContextSymbol } from '/@/inject/symbol';

import { ClaudeSkillsManager } from './claude-skills-manager';

vi.mock(import('node:os'));
vi.mock(import('@kortex-app/api'));

const MOCK_HOME = '/home/testuser';
const CLAUDE_SKILLS_DIR = join(MOCK_HOME, '.claude', 'skills');

describe('ClaudeSkillsManager', () => {
  let claudeSkillsManager: ClaudeSkillsManager;
  let extensionContextMock: ExtensionContext;

  beforeEach(async () => {
    vi.resetAllMocks();
    vi.mocked(homedir).mockReturnValue(MOCK_HOME);

    extensionContextMock = {
      subscriptions: [],
    } as unknown as ExtensionContext;

    const container = new Container();
    container.bind(ClaudeSkillsManager).toSelf();
    container.bind(ExtensionContextSymbol).toConstantValue(extensionContextMock);
    claudeSkillsManager = await container.getAsync<ClaudeSkillsManager>(ClaudeSkillsManager);
  });

  test('getClaudeSkillsDir returns expected path', () => {
    expect(ClaudeSkillsManager.getClaudeSkillsDir()).toBe(CLAUDE_SKILLS_DIR);
  });

  test('registers skill folder with correct parameters', async () => {
    const mockDisposable: Disposable = { dispose: vi.fn() };
    vi.mocked(extensionApi.skills.registerSkillFolder).mockReturnValue(mockDisposable);

    await claudeSkillsManager.init();

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

    await claudeSkillsManager.init();

    expect(extensionContextMock.subscriptions).toContain(mockDisposable);
  });

  test('dispose cleans up skill folder registration', async () => {
    const mockDisposable: Disposable = { dispose: vi.fn() };
    vi.mocked(extensionApi.skills.registerSkillFolder).mockReturnValue(mockDisposable);

    await claudeSkillsManager.init();
    claudeSkillsManager.dispose();

    expect(mockDisposable.dispose).toHaveBeenCalled();
  });
});
