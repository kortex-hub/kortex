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

import type { ExtensionContext } from '@kortex-app/api';
import type { Container } from 'inversify';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { InferenceModelManager } from '/@/manager/inference-model-manager';
import { RamaLamaExtension } from '/@/ramalama-extension';

vi.mock(import('@kortex-app/api'));
vi.mock(import('./manager/inference-model-manager'));

class TestRamaLamaExtension extends RamaLamaExtension {
  getContainer(): Container | undefined {
    return super.getContainer();
  }
}

describe('RamaLamaExtension', () => {
  let extensionContext: ExtensionContext;
  let ramaLamaExtension: TestRamaLamaExtension;

  beforeEach(async () => {
    vi.resetAllMocks();
    vi.clearAllMocks();
    extensionContext = { subscriptions: [] } as unknown as ExtensionContext;
    ramaLamaExtension = new TestRamaLamaExtension(extensionContext);
  });

  test('activate', async () => {
    await ramaLamaExtension.activate();
    expect(InferenceModelManager.prototype.init).toHaveBeenCalled();
  });

  test('activate handles error during container creation', async () => {
    // bind an object that will throw when getAsync is called
    const faultyGetAsync = vi.fn().mockRejectedValue(new Error('Container creation failed'));
    vi.spyOn(ramaLamaExtension, 'getContainer').mockReturnValue({
      getAsync: faultyGetAsync,
    } as unknown as Container);
    await expect(ramaLamaExtension.activate()).rejects.toThrow('Container creation failed');
  });

  test('deactivate disposes subscriptions', async () => {
    await ramaLamaExtension.activate();
    await ramaLamaExtension.deactivate();
    expect(InferenceModelManager.prototype.dispose).toHaveBeenCalled();
  });
});
