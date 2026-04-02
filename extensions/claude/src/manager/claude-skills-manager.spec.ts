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
import { Container } from 'inversify';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { ClaudeProviderSymbol } from '/@/inject/symbol';

import { ClaudeSkillsManager } from './claude-skills-manager';

vi.mock(import('node:os'));

const MOCK_HOME = '/home/testuser';
const CLAUDE_SKILLS_DIR = join(MOCK_HOME, '.claude', 'skills');

const disposableMock: Disposable = { dispose: vi.fn() };
const providerMock: Provider = {
  registerSkill: vi.fn(),
} as unknown as Provider;

describe('ClaudeSkillsManager', () => {
  let claudeSkillsManager: ClaudeSkillsManager;

  beforeEach(async () => {
    vi.resetAllMocks();
    vi.mocked(homedir).mockReturnValue(MOCK_HOME);
    vi.mocked(providerMock.registerSkill).mockReturnValue(disposableMock);

    const container = new Container();
    container.bind(ClaudeSkillsManager).toSelf();
    container.bind(ClaudeProviderSymbol).toConstantValue(providerMock);
    claudeSkillsManager = await container.getAsync<ClaudeSkillsManager>(ClaudeSkillsManager);
  });

  test('getClaudeSkillsDir returns expected path', () => {
    expect(ClaudeSkillsManager.getClaudeSkillsDir()).toBe(CLAUDE_SKILLS_DIR);
  });

  test('registers skill with correct parameters via provider', async () => {
    await claudeSkillsManager.init();

    expect(providerMock.registerSkill).toHaveBeenCalledWith({
      label: 'Claude',
      path: CLAUDE_SKILLS_DIR,
    });
  });

  test('dispose cleans up skill registration', async () => {
    await claudeSkillsManager.init();
    claudeSkillsManager.dispose();

    expect(disposableMock.dispose).toHaveBeenCalled();
  });
});
