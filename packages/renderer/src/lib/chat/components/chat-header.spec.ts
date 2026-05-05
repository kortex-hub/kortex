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

import '@testing-library/jest-dom/vitest';

import { render } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import ChatHeader from './chat-header.svelte';
import { useSidebar } from './ui/sidebar/context.svelte';
import { Tooltip } from './ui/tooltip';

vi.mock(import('tinro'));
vi.mock(import('./sidebar-toggle.svelte'));
vi.mock(import('./ui/sidebar/context.svelte'));
vi.mock(import('./ui/tooltip'));

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.resetAllMocks();
  vi.mocked(useSidebar).mockReturnValue({
    open: false,
    isMobile: false,
    openMobile: false,
    state: 'collapsed',
    setOpen: vi.fn(),
    setOpenMobile: vi.fn(),
    toggle: vi.fn(),
    handleShortcutKeydown: vi.fn(),
  } as never);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ChatHeader', () => {
  test('should render New Chat tooltip when hasModels is true and sidebar is closed', () => {
    render(ChatHeader, { hasModels: true });

    expect(Tooltip).toHaveBeenCalled();
  });

  test('should hide New Chat button when hasModels is false', () => {
    render(ChatHeader, { hasModels: false });

    expect(Tooltip).not.toHaveBeenCalled();
  });

  test('should hide New Chat button when hasModels is not provided', () => {
    render(ChatHeader);

    expect(Tooltip).not.toHaveBeenCalled();
  });

  test('should hide New Chat button when sidebar is open on wide viewport', () => {
    vi.mocked(useSidebar).mockReturnValue({
      open: true,
      isMobile: false,
      openMobile: false,
      state: 'expanded',
      setOpen: vi.fn(),
      setOpenMobile: vi.fn(),
      toggle: vi.fn(),
      handleShortcutKeydown: vi.fn(),
    } as never);

    render(ChatHeader, { hasModels: true });

    expect(Tooltip).not.toHaveBeenCalled();
  });
});
