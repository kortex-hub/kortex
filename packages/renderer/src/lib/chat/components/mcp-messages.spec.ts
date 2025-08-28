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
import '@testing-library/jest-dom/vitest';

import type { UIMessage } from '@ai-sdk/svelte';
import { render, screen } from '@testing-library/svelte';
import type { DynamicToolUIPart } from 'ai';
import { describe, expect, test } from 'vitest';

import MCPMessages from './mcp-messages.svelte';

function dynamicTool(toolName: string, id: string, extra?: Partial<DynamicToolUIPart>): DynamicToolUIPart {
  return {
    type: 'dynamic-tool',
    state: 'call-arguments',
    toolCallId: id,
    toolName,
    input: { foo: id },
    ...(extra ?? {}),
  } as DynamicToolUIPart;
}

describe('mcp-messages.svelte', () => {
  test('shows empty state when no assistant dynamic-tool parts are present', () => {
    const messages: UIMessage[] = [
      { id: 'u1', role: 'user', parts: [{ type: 'text', text: 'Hello' }] },
      { id: 'a1', role: 'assistant', parts: [{ type: 'text', text: 'Hi!' }] },
      // dynamic-tool but from user: must be ignored
      { id: 'u2', role: 'user', parts: [dynamicTool('Ignored Tool', 't0')] },
    ];

    render(MCPMessages, { messages });

    // Header should always be present
    expect(screen.getByText('MCP')).toBeInTheDocument();

    // Empty state should be visible
    expect(screen.getByText('No MCP activity yet.')).toBeInTheDocument();
  });

  test('renders one entry per assistant message that contains dynamic-tool parts', () => {
    const msgWithOneTool: UIMessage = {
      id: 'a1',
      role: 'assistant',
      parts: [dynamicTool('Tool A', 't1')],
    };

    const msgWithTwoTools: UIMessage = {
      id: 'a2',
      role: 'assistant',
      parts: [dynamicTool('Tool B1', 't2'), dynamicTool('Tool B2', 't3')],
    };

    const assistantWithoutTools: UIMessage = {
      id: 'a3',
      role: 'assistant',
      parts: [{ type: 'text', text: 'no tools here' }],
    };

    const systemMessage: UIMessage = {
      id: 's1',
      role: 'system',
      parts: [dynamicTool('System Tool', 'tX')], // should be ignored because not assistant
    };

    const messages = [
      { id: 'u1', role: 'user', parts: [{ type: 'text', text: 'Hello' }] } satisfies UIMessage,
      msgWithOneTool,
      msgWithTwoTools,
      assistantWithoutTools,
      systemMessage,
    ];

    const { container } = render(MCPMessages, { messages });

    // Empty state should not be present
    expect(screen.queryByText('No MCP activity yet.')).not.toBeInTheDocument();

    // The component wraps each ToolParts in a specific container div; count them
    const entryContainers = container.querySelectorAll('.rounded-md.bg-background.p-2.ring-1.ring-border');
    expect(entryContainers.length).toBe(2); // only a1 and a2 contain dynamic-tool parts

    // Ensure tool names from ToolParts appear (verifies children rendered)
    expect(screen.getByText('Tool A')).toBeInTheDocument();
    expect(screen.getByText('Tool B1')).toBeInTheDocument();
    expect(screen.getByText('Tool B2')).toBeInTheDocument();

    // Assistant without tools and non-assistant dynamic tools should not contribute entries
    expect(screen.queryByText('System Tool')).not.toBeInTheDocument();
  });
});
