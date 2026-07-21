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

import type { Disposable, ExtensionContext } from '@openkaiden/api';
import { agents } from '@openkaiden/api';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { activate } from './extension';

const AGENT_DISPOSABLE_MOCK: Disposable = { dispose: vi.fn() };

let extensionContextMock: ExtensionContext;

beforeEach(() => {
  vi.resetAllMocks();

  extensionContextMock = {
    subscriptions: [],
  } as unknown as ExtensionContext;

  vi.mocked(agents.registerAgent).mockReturnValue(AGENT_DISPOSABLE_MOCK);
});

describe('activate', () => {
  test('registers goose agent', async () => {
    await activate(extensionContextMock);

    expect(agents.registerAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'goose',
        name: 'Goose',
        description: expect.any(String),
        icon: expect.objectContaining({ icon: { dark: './icon_dark.png', light: './icon_light.png' } }),
        destinationSkillsFolder: '${HOME}/.agents/skills',
        isSupportedModelType: expect.any(Function),
      }),
    );
  });

  test('pushes agent disposable to subscriptions', async () => {
    await activate(extensionContextMock);

    expect(extensionContextMock.subscriptions).toContain(AGENT_DISPOSABLE_MOCK);
  });

  test('registered agent supports all model types', async () => {
    await activate(extensionContextMock);

    const agent = vi.mocked(agents.registerAgent).mock.calls[0]![0];
    expect(agent.isSupportedModelType!({ name: 'gemini' })).toBe(true);
    expect(agent.isSupportedModelType!({ name: 'openai' })).toBe(true);
  });
});
