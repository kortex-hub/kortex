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
 **********************************************************************/

import type { ExtensionContext } from '@openkaiden/api';
import type { Container } from 'inversify';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { OpenshellCliManager } from '/@/manager/openshell-cli-manager';
import { OpenshellExtension } from '/@/openshell-extension';

vi.mock(import('@openkaiden/api'));
vi.mock(import('/@/manager/openshell-cli-manager'));

class TestOpenshellExtension extends OpenshellExtension {
  getContainer(): Container | undefined {
    return super.getContainer();
  }
}

describe('OpenshellExtension', () => {
  let extensionContext: ExtensionContext;
  let openshellExtension: TestOpenshellExtension;

  beforeEach(() => {
    vi.resetAllMocks();
    extensionContext = { subscriptions: [] } as unknown as ExtensionContext;
    openshellExtension = new TestOpenshellExtension(extensionContext);
  });

  test('activate initializes OpenshellCliManager', async () => {
    await openshellExtension.activate();

    expect(OpenshellCliManager.prototype.init).toHaveBeenCalled();
  });

  test('deactivate disposes resources', async () => {
    await openshellExtension.activate();

    await openshellExtension.deactivate();
  });

  test('deactivate is safe to call without activate', async () => {
    await openshellExtension.deactivate();
  });
});
