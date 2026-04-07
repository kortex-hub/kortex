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

import type { UIMessage } from '@ai-sdk/svelte';
import { fireEvent, render } from '@testing-library/svelte';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { EditState } from '/@/lib/chat/hooks/edit-state.svelte';

import MessageActionsTest from './message-actions-test.svelte';

vi.mock(import('/@/lib/chat/hooks/edit-state.svelte'));

const startEditingMock = vi.fn();

beforeEach(() => {
  vi.resetAllMocks();

  vi.mocked(EditState.fromContext).mockReturnValue({
    isAfterEditingMessage: vi.fn(() => false),
    isEditing: false,
    startEditing: startEditingMock,
    editingMessage: undefined,
    cancelEditing: vi.fn(),
  });

  (window as unknown as Record<string, unknown>).clipboardWriteText = vi.fn().mockResolvedValue(undefined);
});

describe('MessageActions', () => {
  test('should show copy button for assistant messages', () => {
    const message: UIMessage = {
      id: 'msg1',
      role: 'assistant',
      parts: [{ type: 'text', text: 'Hello world' }],
    };

    const { getByLabelText } = render(MessageActionsTest, {
      message,
      readonly: false,
    });

    expect(getByLabelText('Copy message')).toBeInTheDocument();
  });

  test('should show edit and copy buttons for user messages', () => {
    const message: UIMessage = {
      id: 'msg1',
      role: 'user',
      parts: [{ type: 'text', text: 'User question' }],
    };

    const { getByLabelText } = render(MessageActionsTest, {
      message,
      readonly: false,
    });

    expect(getByLabelText('Edit message')).toBeInTheDocument();
    expect(getByLabelText('Copy message')).toBeInTheDocument();
  });

  test('should not show edit button for user messages in readonly mode', () => {
    const message: UIMessage = {
      id: 'msg1',
      role: 'user',
      parts: [{ type: 'text', text: 'User question' }],
    };

    const { queryByLabelText, getByLabelText } = render(MessageActionsTest, {
      message,
      readonly: true,
    });

    expect(queryByLabelText('Edit message')).not.toBeInTheDocument();
    expect(getByLabelText('Copy message')).toBeInTheDocument();
  });

  test('should not show edit button for assistant messages', () => {
    const message: UIMessage = {
      id: 'msg1',
      role: 'assistant',
      parts: [{ type: 'text', text: 'Response' }],
    };

    const { queryByLabelText } = render(MessageActionsTest, {
      message,
      readonly: false,
    });

    expect(queryByLabelText('Edit message')).not.toBeInTheDocument();
  });

  test('should copy message text to clipboard on click', async () => {
    const message: UIMessage = {
      id: 'msg1',
      role: 'assistant',
      parts: [
        { type: 'text', text: 'First part' },
        { type: 'text', text: 'Second part' },
      ],
    };

    const { getByLabelText } = render(MessageActionsTest, {
      message,
      readonly: false,
    });

    await fireEvent.click(getByLabelText('Copy message'));

    expect(window.clipboardWriteText).toHaveBeenCalledWith('First part\nSecond part');
  });

  test('should call startEditing when edit button is clicked', async () => {
    const message: UIMessage = {
      id: 'msg1',
      role: 'user',
      parts: [{ type: 'text', text: 'User question' }],
    };

    const { getByLabelText } = render(MessageActionsTest, {
      message,
      readonly: false,
    });

    await fireEvent.click(getByLabelText('Edit message'));

    expect(startEditingMock).toHaveBeenCalledWith(message);
  });
});
