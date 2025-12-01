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

import { activate, deactivate } from './extension';
import { MilvusExtension } from './milvus-extension';

let extensionContextMock: ExtensionContext;

vi.mock(import('./milvus-extension'));

beforeEach(() => {
  vi.restoreAllMocks();
  vi.resetAllMocks();

  // Create a mock for the ExtensionContext
  extensionContextMock = {} as ExtensionContext;
  vi.mocked(MilvusExtension.prototype.activate).mockResolvedValue(undefined);
});

test('should initialize and activate the MilvusExtension when activate is called', async () => {
  // Call activate
  await activate(extensionContextMock);

  // Ensure that the MilvusExtension is instantiated and its activate method is called
  expect(MilvusExtension.prototype.activate).toHaveBeenCalled();
});

test('should call deactivate when deactivate is called', async () => {
  // Call activate first to initialize milvusExtension
  await activate(extensionContextMock);

  // Call deactivate
  await deactivate();

  // Ensure that the deactivate method was called
  expect(MilvusExtension.prototype.deactivate).toHaveBeenCalled();
});

test('should handle errors during activation', async () => {
  const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  const error = new Error('Activation failed');

  vi.mocked(MilvusExtension.prototype.activate).mockRejectedValue(error);

  // Call activate - should not throw but log error
  await activate(extensionContextMock);

  // Ensure error was logged
  expect(consoleErrorSpy).toHaveBeenCalledWith(error);
});

test('should not fail when deactivate is called before activate', async () => {
  // Call deactivate without calling activate first
  await expect(deactivate()).resolves.toBeUndefined();
});

test('should reuse existing MilvusExtension instance on subsequent activate calls', async () => {
  // Call activate twice
  await activate(extensionContextMock);
  await activate(extensionContextMock);

  // The constructor should only be called once due to ??= operator
  expect(MilvusExtension).toHaveBeenCalledTimes(1);
  // But activate should be called twice
  expect(MilvusExtension.prototype.activate).toHaveBeenCalledTimes(2);
});
