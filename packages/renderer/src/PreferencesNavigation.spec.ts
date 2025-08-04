/**********************************************************************
 * Copyright (C) 2023-2025 Red Hat, Inc.
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

import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/svelte';
import type { TinroRouteMeta } from 'tinro';
import { beforeEach, expect, test, vi } from 'vitest';

import PreferencesNavigation from './PreferencesNavigation.svelte';

// fake the window.events object
beforeEach(() => {
  vi.resetAllMocks();
  Object.defineProperty(global, 'window', {
    value: {
      getConfigurationValue: vi.fn(),
      events: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        receive: (_channel: string, func: any) => {
          func();
        },
      },
    },
    writable: true,
  });
  vi.mocked(window.getConfigurationValue<boolean>).mockResolvedValue(true);
});

test('Test rendering of the preferences navigation bar and its items', () => {
  render(PreferencesNavigation, {
    meta: {
      url: '/',
    } as unknown as TinroRouteMeta,
  });

  const navigationBar = screen.getByRole('navigation', { name: 'PreferencesNavigation' });
  expect(navigationBar).toBeVisible();

  const proxy = screen.getByRole('link', { name: 'Proxy' });
  expect(proxy).toBeVisible();
});
