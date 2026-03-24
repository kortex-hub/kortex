/**********************************************************************
 * Copyright (C) 2025-2026 Red Hat, Inc.
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

import type { UIMessage } from 'ai';
import { isTextUIPart } from 'ai';
import type { WebContents } from 'electron';
import { beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';

import type { Directories } from '/@/plugin/directories.js';
import type { MCPManager } from '/@/plugin/mcp/mcp-manager.js';
import type { ProviderRegistry } from '/@/plugin/provider-registry.js';

import { ChatManager } from './chat-manager.js';

vi.mock(import('ai'));
vi.mock(import('better-sqlite3'));
vi.mock(import('drizzle-orm/better-sqlite3'));
vi.mock(import('./db/migrate.js'));

const mockWebContents = {
  send: vi.fn(),
} as unknown as WebContents;

const mockProviderRegistry = {
  getMatchingProviderInternalId: vi.fn().mockReturnValue('internal-id'),
  getInferenceSDK: vi.fn().mockReturnValue({
    languageModel: vi.fn().mockReturnValue('mock-model'),
  }),
} as unknown as ProviderRegistry;

const mockMcpManager = {
  getToolSet: vi.fn().mockResolvedValue({}),
  getExchanges: vi.fn().mockResolvedValue([]),
} as unknown as MCPManager;

const mockDirectories = {
  getChatPersistenceDirectory: vi.fn().mockReturnValue('/tmp/test-chat'),
} as unknown as Directories;

const mockIpcHandle = vi.fn();

function createChatManager(): ChatManager {
  return new (ChatManager as unknown as new (...args: unknown[]) => ChatManager)(
    mockProviderRegistry,
    mockMcpManager,
    mockWebContents,
    mockIpcHandle,
    mockDirectories,
  );
}

describe('ChatManager', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(isTextUIPart).mockImplementation(part => part.type === 'text');
  });

  describe('extractPlaceholderTitle', () => {
    it('should extract text from user message parts', () => {
      const chatManager = createChatManager();
      const userMessage = {
        role: 'user',
        parts: [{ type: 'text', text: 'What is Kubernetes?' }],
      } as UIMessage;

      const title = (
        chatManager as unknown as { extractPlaceholderTitle: (m: UIMessage) => string }
      ).extractPlaceholderTitle(userMessage);
      expect(title).toBe('What is Kubernetes?');
    });

    it('should truncate text to 80 characters', () => {
      const chatManager = createChatManager();
      const longText = 'A'.repeat(120);
      const userMessage = {
        role: 'user',
        parts: [{ type: 'text', text: longText }],
      } as UIMessage;

      const title = (
        chatManager as unknown as { extractPlaceholderTitle: (m: UIMessage) => string }
      ).extractPlaceholderTitle(userMessage);
      expect(title).toHaveLength(80);
    });

    it('should return "New Chat" when message has no text parts', () => {
      const chatManager = createChatManager();
      const userMessage = {
        role: 'user',
        parts: [{ type: 'file', url: 'file://test.png', mediaType: 'image/png' }],
      } as UIMessage;

      const title = (
        chatManager as unknown as { extractPlaceholderTitle: (m: UIMessage) => string }
      ).extractPlaceholderTitle(userMessage);
      expect(title).toBe('New Chat');
    });

    it('should use the first text part when multiple parts exist', () => {
      const chatManager = createChatManager();
      const userMessage = {
        role: 'user',
        parts: [
          { type: 'file', url: 'file://test.png', mediaType: 'image/png' },
          { type: 'text', text: 'Explain this image' },
        ],
      } as UIMessage;

      const title = (
        chatManager as unknown as { extractPlaceholderTitle: (m: UIMessage) => string }
      ).extractPlaceholderTitle(userMessage);
      expect(title).toBe('Explain this image');
    });
  });

  describe('generateTitleInBackground', () => {
    it('should call generateText and update chat title on success', async () => {
      const { generateText } = await import('ai');
      vi.mocked(generateText).mockResolvedValue({ text: 'Generated Title' } as Awaited<
        ReturnType<typeof generateText>
      >);

      const chatManager = createChatManager();
      const mockUpdateChatTitleIfMatches = vi.fn(
        async (): Promise<{ isOk: () => boolean; isErr: () => boolean; value: boolean }> => ({
          isOk: () => true,
          isErr: () => false,
          value: true, // Row was updated
        }),
      );
      (chatManager as unknown as { chatQueries: { updateChatTitleIfMatches: MockInstance } }).chatQueries = {
        updateChatTitleIfMatches: mockUpdateChatTitleIfMatches,
      } as never;

      const mockModel = 'mock-model';
      const userMessage = { role: 'user', parts: [{ type: 'text', text: 'Hello' }] };

      (
        chatManager as unknown as { generateTitleInBackground: (m: unknown, u: unknown, id: string, p: string) => void }
      ).generateTitleInBackground(mockModel, userMessage, 'chat-123', 'Hello');

      await vi.waitFor(() => {
        expect(mockUpdateChatTitleIfMatches).toHaveBeenCalledWith({
          chatId: 'chat-123',
          expectedTitle: 'Hello',
          newTitle: 'Generated Title',
        });
      });

      expect(vi.mocked(mockWebContents.send)).toHaveBeenCalledWith('api-sender', 'chat-list-updated');
    });

    it('should not notify UI when database update fails', async () => {
      const { generateText } = await import('ai');
      vi.mocked(generateText).mockResolvedValue({ text: 'Generated Title' } as Awaited<
        ReturnType<typeof generateText>
      >);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const chatManager = createChatManager();
      const dbError = new Error('DB write failed');
      const mockUpdateChatTitleIfMatches = vi.fn(
        async (): Promise<{ isOk: () => boolean; isErr: () => boolean; error: Error }> => ({
          isOk: () => false,
          isErr: () => true,
          error: dbError,
        }),
      );
      (chatManager as unknown as { chatQueries: { updateChatTitleIfMatches: MockInstance } }).chatQueries = {
        updateChatTitleIfMatches: mockUpdateChatTitleIfMatches,
      } as never;

      const mockModel = 'mock-model';
      const userMessage = { role: 'user', parts: [{ type: 'text', text: 'Hello' }] };

      (
        chatManager as unknown as { generateTitleInBackground: (m: unknown, u: unknown, id: string, p: string) => void }
      ).generateTitleInBackground(mockModel, userMessage, 'chat-123', 'Hello');

      await vi.waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to update chat title in database', dbError);
      });

      expect(vi.mocked(mockWebContents.send)).not.toHaveBeenCalledWith('api-sender', 'chat-list-updated');
      consoleSpy.mockRestore();
    });

    it('should log error and not throw when generateText fails', async () => {
      const { generateText } = await import('ai');
      vi.mocked(generateText).mockRejectedValue(new Error('Model unavailable'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const chatManager = createChatManager();

      const mockModel = 'mock-model';
      const userMessage = { role: 'user', parts: [{ type: 'text', text: 'Hello' }] };

      (
        chatManager as unknown as { generateTitleInBackground: (m: unknown, u: unknown, id: string, p: string) => void }
      ).generateTitleInBackground(mockModel, userMessage, 'chat-123', 'Hello');

      await vi.waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to generate chat title', expect.any(Error));
      });

      consoleSpy.mockRestore();
    });

    it('should not update title if user has manually renamed the chat', async () => {
      const { generateText } = await import('ai');
      vi.mocked(generateText).mockResolvedValue({ text: 'Generated Title' } as Awaited<
        ReturnType<typeof generateText>
      >);

      const chatManager = createChatManager();
      // Simulate user has renamed the chat - atomic update returns false (no rows updated)
      const mockUpdateChatTitleIfMatches = vi.fn(
        async (): Promise<{ isOk: () => boolean; isErr: () => boolean; value: boolean }> => ({
          isOk: () => true,
          isErr: () => false,
          value: false, // No rows updated - title didn't match
        }),
      );
      (chatManager as unknown as { chatQueries: { updateChatTitleIfMatches: MockInstance } }).chatQueries = {
        updateChatTitleIfMatches: mockUpdateChatTitleIfMatches,
      } as never;

      const mockModel = 'mock-model';
      const userMessage = { role: 'user', parts: [{ type: 'text', text: 'Hello' }] };

      (
        chatManager as unknown as { generateTitleInBackground: (m: unknown, u: unknown, id: string, p: string) => void }
      ).generateTitleInBackground(mockModel, userMessage, 'chat-123', 'Hello');

      await vi.waitFor(() => {
        expect(mockUpdateChatTitleIfMatches).toHaveBeenCalledWith({
          chatId: 'chat-123',
          expectedTitle: 'Hello',
          newTitle: 'Generated Title',
        });
      });

      // Should NOT emit event because no rows were updated (title was changed by user)
      expect(vi.mocked(mockWebContents.send)).not.toHaveBeenCalledWith('api-sender', 'chat-list-updated');
    });
  });
});
