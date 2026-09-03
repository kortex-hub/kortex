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

import { getLock } from '/@/lib/chat/hooks/lock.svelte';

import MessageReasoning from './message-reasoning.svelte';

vi.mock(import('/@/lib/chat/hooks/lock.svelte'));

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getLock).mockReturnValue({
    locked: false,
    lockTransition: vi.fn(),
    unlockTransition: vi.fn(),
    userScrolledAway: false,
    transitionLockCount: 0,
  });
});

describe('MessageReasoning', () => {
  test('should show "Reasoning..." when loading with no text content yet', () => {
    render(MessageReasoning, {
      loading: true,
      reasoningContent: '',
      hasText: false,
    });

    expect(screen.getByText('Reasoning...')).toBeInTheDocument();
    expect(screen.queryByText(/^Reasoned for/)).not.toBeInTheDocument();
  });

  test('should show "Reasoning..." when loading with partial reasoning but no text yet', () => {
    render(MessageReasoning, {
      loading: true,
      reasoningContent: 'Some reasoning content',
      hasText: false,
    });

    expect(screen.getByText('Reasoning...')).toBeInTheDocument();
    expect(screen.queryByText(/^Reasoned for/)).not.toBeInTheDocument();
  });

  test('should show "Reasoned for..." when loading but text has started', () => {
    const { container } = render(MessageReasoning, {
      loading: true,
      reasoningContent: 'Some reasoning content',
      hasText: true,
    });

    expect(container.textContent).toMatch(/Reasoned for/);
    expect(screen.queryByText('Reasoning...', { exact: true })).not.toBeInTheDocument();
  });

  test('should show "Reasoned for..." when not loading', () => {
    const { container } = render(MessageReasoning, {
      loading: false,
      reasoningContent: 'Some reasoning content',
      hasText: true,
    });

    expect(container.textContent).toMatch(/Reasoned for/);
    expect(screen.queryByText('Reasoning...', { exact: true })).not.toBeInTheDocument();
  });
});
