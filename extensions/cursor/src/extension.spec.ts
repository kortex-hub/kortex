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

import { CursorExtension } from './cursor-extension';
import { activate } from './extension';

vi.mock(import('@openkaiden/api'));
vi.mock(import('./cursor-extension'));

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
  test('creates Cursor extension', async () => {
    await activate(extensionContextMock);

    expect(CursorExtension).toHaveBeenCalledWith(extensionContextMock);
    expect(vi.mocked(CursorExtension.prototype.activate)).toHaveBeenCalled();
  });

  test('registers cursor agent', async () => {
    await activate(extensionContextMock);

    expect(agents.registerAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'cursor',
        name: 'Cursor CLI',
        description: expect.any(String),
        icon: expect.objectContaining({
          icon: { dark: './APP_ICON_2D_DARK.png', light: './APP_ICON_2D_LIGHT.png' },
        }),
        tags: ['Local'],
        isSupportedModelType: expect.any(Function),
      }),
    );
  });

  test('pushes agent disposable to subscriptions', async () => {
    await activate(extensionContextMock);

    expect(extensionContextMock.subscriptions).toContain(AGENT_DISPOSABLE_MOCK);
  });

  test('registered agent supports only cursor model type', async () => {
    await activate(extensionContextMock);

    const agent = vi.mocked(agents.registerAgent).mock.calls[0]![0];
    expect(agent.isSupportedModelType!({ name: 'cursor' })).toBe(true);
    expect(agent.isSupportedModelType!({ name: 'openai' })).toBe(false);
    expect(agent.isSupportedModelType!({ name: 'anthropic' })).toBe(false);
  });
});
