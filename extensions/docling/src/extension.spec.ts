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
import { beforeEach, expect, test, vi } from 'vitest';

import { DoclingExtension } from './docling-extension';
import { activate, deactivate } from './extension';

let extensionContextMock: ExtensionContext;

vi.mock(import('./docling-extension'));

beforeEach(() => {
  vi.restoreAllMocks();
  vi.resetAllMocks();

  // Create a mock for the ExtensionContext
  extensionContextMock = {} as ExtensionContext;
  vi.mocked(DoclingExtension.prototype.activate).mockResolvedValue(undefined);
});

test('should initialize and activate the DoclingExtension when activate is called', async () => {
  // Call activate
  await activate(extensionContextMock);

  // Ensure that the DoclingExtension is instantiated and its activate method is called
  await vi.waitFor(() => expect(DoclingExtension.prototype.activate).toHaveBeenCalled());

  await deactivate();
});

test('should call deactivate when deactivate is called', async () => {
  // Call activate first to initialize DoclingExtension
  await activate(extensionContextMock);
  await vi.waitFor(() => expect(DoclingExtension.prototype.activate).toHaveBeenCalled());

  // Call deactivate
  await deactivate();
  await vi.waitFor(() => expect(DoclingExtension.prototype.deactivate).toHaveBeenCalled());
});

test('should handle error during activation', async () => {
  // Mock activate to throw an error
  const error = new Error('Activation failed');
  vi.mocked(DoclingExtension.prototype.activate).mockRejectedValue(error);

  // Spy on console.error
  const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

  // Call activate
  await activate(extensionContextMock);
  await vi.waitFor(() => expect(DoclingExtension.prototype.activate).toHaveBeenCalled());

  // Verify error was logged
  expect(consoleErrorSpy).toHaveBeenCalled();

  consoleErrorSpy.mockRestore();

  await deactivate();
});

test('should handle deactivate when extension is not initialized', async () => {
  // Call deactivate without calling activate
  await deactivate();

  // Should not throw and should not call deactivate on undefined
  expect(DoclingExtension.prototype.deactivate).not.toHaveBeenCalled();
});
