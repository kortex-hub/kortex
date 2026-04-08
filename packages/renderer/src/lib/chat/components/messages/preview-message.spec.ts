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
import { render } from '@testing-library/svelte';
import { tick } from 'svelte';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { EditState } from '/@/lib/chat/hooks/edit-state.svelte';
import { getLock } from '/@/lib/chat/hooks/lock.svelte';

import PreviewMessageReactiveTest from './preview-message-reactive-test.svelte';
import PreviewMessageTest from './preview-message-test.svelte';

vi.mock(import('/@/lib/chat/hooks/edit-state.svelte'));
vi.mock(import('/@/lib/chat/hooks/lock.svelte'));

// Mock animations
beforeEach(() => {
  vi.resetAllMocks();

  // Configure mocked modules
  vi.mocked(EditState.fromContext).mockReturnValue({
    isAfterEditingMessage: vi.fn(() => false),
    isEditing: false,
    startEditing: vi.fn(),
    editingMessage: undefined,
    cancelEditing: vi.fn(),
  });
  vi.mocked(getLock).mockReturnValue({
    locked: false,
    lockTransition: vi.fn(),
    unlockTransition: vi.fn(),
    userScrolledAway: false,
    transitionLockCount: 0,
  });

  if (!HTMLElement.prototype.animate) {
    HTMLElement.prototype.animate = vi.fn(() => ({
      finished: Promise.resolve(),
      onfinish: null,
      cancel: vi.fn(),
    })) as unknown as typeof HTMLElement.prototype.animate;
  }
});

describe('PreviewMessage - Reasoning and Response Display', () => {
  test('should render reasoning and text content when both are present', () => {
    const message: UIMessage = {
      id: 'msg1',
      role: 'assistant',
      parts: [
        { type: 'reasoning', text: 'Reasoning content' },
        { type: 'text', text: 'Response text' },
      ],
    };

    const { container } = render(PreviewMessageTest, {
      message,
      messages: [message],
      readonly: true,
      loading: false,
    });

    // Both reasoning and text should be rendered
    const content = container.textContent ?? '';
    expect(content).toMatch(/Reasoned for/);
    expect(content).toContain('Response text');

    // Verify reasoning appears before response text in the DOM
    const reasoningMatch = /Reasoned for/.exec(content);
    const reasoningIndex = reasoningMatch ? content.indexOf(reasoningMatch[0]) : -1;
    const textIndex = content.indexOf('Response text');
    expect(reasoningIndex).toBeGreaterThan(-1);
    expect(textIndex).toBeGreaterThan(-1);
    expect(reasoningIndex).toBeLessThan(textIndex);
  });

  test('should show spinner when loading last assistant message without reasoning', () => {
    const message: UIMessage = {
      id: 'msg1',
      role: 'assistant',
      parts: [{ type: 'text', text: 'Response text' }],
    };

    const { container } = render(PreviewMessageTest, {
      message,
      messages: [message],
      readonly: true,
      loading: true,
    });

    // Check for spinner (LoaderIcon is rendered inside animate-spin div)
    const spinner = container.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  test('should show generating spinner when loading with reasoning but no text yet', () => {
    const message: UIMessage = {
      id: 'msg1',
      role: 'assistant',
      parts: [{ type: 'reasoning', text: 'Reasoning content' }],
    };

    const { container } = render(PreviewMessageTest, {
      message,
      messages: [message],
      readonly: true,
      loading: true,
    });

    // Should show "Reasoning..." since no text has started yet
    expect(container.textContent).toContain('Reasoning...');
    expect(container.textContent).not.toMatch(/Reasoned for/);
    // Should show global generating spinner
    const spinners = container.querySelectorAll('.animate-spin');
    expect(spinners.length).toBe(1);
  });

  test('should show generating spinner when loading with reasoning and text', () => {
    const message: UIMessage = {
      id: 'msg1',
      role: 'assistant',
      parts: [
        { type: 'reasoning', text: 'Reasoning content' },
        { type: 'text', text: 'Response text' },
      ],
    };

    const { container } = render(PreviewMessageTest, {
      message,
      messages: [message],
      readonly: true,
      loading: true,
    });

    // Should show "Reasoned for..." since text has started
    expect(container.textContent).toMatch(/Reasoned for/);
    // Should show global generating spinner since still loading
    const spinners = container.querySelectorAll('.animate-spin');
    expect(spinners.length).toBe(1);
  });

  test('should not show generating spinner when not loading', () => {
    const message: UIMessage = {
      id: 'msg1',
      role: 'assistant',
      parts: [
        { type: 'reasoning', text: 'Reasoning content' },
        { type: 'text', text: 'Response text' },
      ],
    };

    const { container } = render(PreviewMessageTest, {
      message,
      messages: [message],
      readonly: true,
      loading: false,
    });

    // Count spinners - the generating response spinner should not be present
    const spinners = container.querySelectorAll('.animate-spin');
    // No generating response spinner when not loading
    expect(spinners.length).toBe(0);
  });

  test('should not show spinner for earlier assistant messages when loading', () => {
    const earlierMessage: UIMessage = {
      id: 'msg1',
      role: 'assistant',
      parts: [{ type: 'text', text: 'Earlier response' }],
    };

    const laterMessage: UIMessage = {
      id: 'msg2',
      role: 'assistant',
      parts: [{ type: 'text', text: 'Current response' }],
    };

    const { container } = render(PreviewMessageTest, {
      message: earlierMessage,
      messages: [earlierMessage, laterMessage],
      readonly: true,
      loading: true,
    });

    // Should not show spinner for earlier assistant messages
    const spinner = container.querySelector('.animate-spin');
    expect(spinner).not.toBeInTheDocument();
  });

  test('should not show spinner for user messages', () => {
    const message: UIMessage = {
      id: 'msg1',
      role: 'user',
      parts: [{ type: 'text', text: 'User question' }],
    };

    const { container } = render(PreviewMessageTest, {
      message,
      messages: [message],
      readonly: true,
      loading: true,
    });

    // Should not show spinner for user messages
    const spinner = container.querySelector('.animate-spin');
    expect(spinner).not.toBeInTheDocument();
  });

  test('should render only text when no reasoning present', () => {
    const message: UIMessage = {
      id: 'msg1',
      role: 'assistant',
      parts: [{ type: 'text', text: 'Response without reasoning' }],
    };

    const { container } = render(PreviewMessageTest, {
      message,
      messages: [message],
      readonly: true,
      loading: false,
    });

    expect(container.textContent).toContain('Response without reasoning');
    expect(container.textContent).not.toMatch(/Reasoned for/);
    expect(container.textContent).not.toContain('Reasoning');
  });

  test('should handle multiple text parts', () => {
    const message: UIMessage = {
      id: 'msg1',
      role: 'assistant',
      parts: [
        { type: 'text', text: 'First part' },
        { type: 'text', text: 'Second part' },
      ],
    };

    const { container } = render(PreviewMessageTest, {
      message,
      messages: [message],
      readonly: true,
      loading: false,
    });

    expect(container.textContent).toContain('First part');
    expect(container.textContent).toContain('Second part');
  });

  test('should handle multiple reasoning parts', () => {
    const message: UIMessage = {
      id: 'msg1',
      role: 'assistant',
      parts: [
        { type: 'reasoning', text: 'First reasoning' },
        { type: 'reasoning', text: 'Second reasoning' },
        { type: 'text', text: 'Response' },
      ],
    };

    const { container } = render(PreviewMessageTest, {
      message,
      messages: [message],
      readonly: true,
      loading: false,
    });

    // Should render both reasoning and response text
    expect(container.textContent).toMatch(/Reasoned for/);
    expect(container.textContent).toContain('Response');
  });
});

describe('PreviewMessage - Tool Parts Reactivity', () => {
  test('should render tool parts when present from the start', () => {
    const message: UIMessage = {
      id: 'msg1',
      role: 'assistant',
      parts: [
        {
          type: 'dynamic-tool',
          toolCallId: 'call1',
          toolName: 'list_issues',
          state: 'output-available',
          input: { repo: 'test/repo' },
          output: { issues: [] },
        },
        { type: 'text', text: 'Here are the results' },
      ],
    };

    const { container } = render(PreviewMessageTest, {
      message,
      messages: [message],
      readonly: true,
      loading: false,
    });

    expect(container.textContent).toContain('list_issues');
    expect(container.textContent).toContain('Here are the results');
  });

  test('should reactively show tool parts added after initial render', async () => {
    const { component, container } = render(PreviewMessageReactiveTest, {
      readonly: true,
      loading: true,
    });

    // Set initial parts via the component method
    component.setParts([{ type: 'text', text: 'Thinking...' }]);
    await tick();

    // Initially no tool parts
    expect(container.textContent).not.toContain('list_issues');

    // Simulate a tool call part arriving later in the stream
    component.addPart({
      type: 'dynamic-tool',
      toolCallId: 'call1',
      toolName: 'list_issues',
      state: 'input-available',
      input: { repo: 'test/repo' },
    });

    await tick();

    // Tool part should now be visible
    expect(container.textContent).toContain('list_issues');
  });
});
