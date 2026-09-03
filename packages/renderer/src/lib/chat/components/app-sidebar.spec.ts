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

import { render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import AppSidebar from './app-sidebar.svelte';
import { useSidebar } from './ui/sidebar/context.svelte';

vi.mock(import('tinro'));
vi.mock(import('./sidebar-history'));
vi.mock(import('./ui/sidebar/context.svelte'), () => ({
  useSidebar: vi.fn(),
  setSidebar: vi.fn(),
}));
vi.mock(import('./ui/tooltip'));

beforeEach(() => {
  vi.resetAllMocks();
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
});

describe('AppSidebar', () => {
  test('should show Chatbot title when sidebar is open', () => {
    render(AppSidebar, { chatId: undefined, hasModels: true });

    expect(screen.getByText('Chatbot')).toBeInTheDocument();
  });

  test('should hide New Chat button when hasModels is false', () => {
    render(AppSidebar, { chatId: undefined, hasModels: false });

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  test('should hide New Chat button when hasModels is not provided', () => {
    render(AppSidebar, { chatId: undefined });

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  test('should show Chatbot title even when hasModels is false', () => {
    render(AppSidebar, { chatId: undefined, hasModels: false });

    expect(screen.getByText('Chatbot')).toBeInTheDocument();
  });

  test('should not render sidebar when context is closed', () => {
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

    render(AppSidebar, { chatId: undefined, hasModels: true });

    expect(screen.queryByText('Chatbot')).not.toBeInTheDocument();
  });
});
