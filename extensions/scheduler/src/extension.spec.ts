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
import { SchedulerExtension } from './scheduler-extension';

let extensionContextMock: ExtensionContext;

vi.mock(import('./scheduler-extension'));

beforeEach(() => {
  vi.restoreAllMocks();
  vi.resetAllMocks();

  // Create a mock for the ExtensionContext
  extensionContextMock = {} as ExtensionContext;
});

test('should initialize and activate the SchedulerExtension when activate is called', async () => {
  // Call activate
  await activate(extensionContextMock);

  // Ensure that the SchedulerExtension is instantiated and its activate method is called
  expect(SchedulerExtension.prototype.activate).toHaveBeenCalled();
});

test('should call deactivate when deactivate is called', async () => {
  // Call activate first to initialize schedulerExtension
  await activate(extensionContextMock);

  // Call deactivate
  await deactivate();

  // Ensure that the deactivate method was called
  expect(SchedulerExtension.prototype.deactivate).toHaveBeenCalled();
});
