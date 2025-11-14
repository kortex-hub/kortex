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

import type { ExtensionContext, Provider } from '@kortex-app/api';
import { env, provider } from '@kortex-app/api';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { SchedulerExtension } from './scheduler-extension';

vi.mock(import('@kortex-app/api'));

// Create a TestSchedulerExtension class to expose protected methods if needed
class TestSchedulerExtension extends SchedulerExtension {}

describe('SchedulerExtension', () => {
  let extensionContext: ExtensionContext;
  let schedulerProvider: Provider;
  let extension: TestSchedulerExtension;

  beforeEach(() => {
    schedulerProvider = {
      updateStatus: vi.fn(),
      registerScheduler: vi.fn(),
      dispose: vi.fn(),
    } as unknown as Provider;
    vi.resetAllMocks();
    vi.clearAllMocks();
    vi.mocked(provider.createProvider).mockReturnValue(schedulerProvider);
    extensionContext = { subscriptions: [] } as unknown as ExtensionContext;
    extension = new TestSchedulerExtension(extensionContext);
  });

  test('should add provider to extension context subscriptions on macOS', async () => {
    vi.mocked(env).isMac = true;
    vi.mocked(env).isWindows = false;
    await extension.activate();
    expect(extensionContext.subscriptions).toContain(schedulerProvider);
  });

  test('should add provider to extension context subscriptions on Windows', async () => {
    vi.mocked(env).isMac = false;
    vi.mocked(env).isWindows = true;

    await extension.activate();
    expect(extensionContext.subscriptions).toContain(schedulerProvider);
  });

  test('should deactivate successfully', async () => {
    await expect(extension.deactivate()).resolves.toBeUndefined();
  });
});
