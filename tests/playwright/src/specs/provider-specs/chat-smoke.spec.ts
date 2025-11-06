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
import { expect, test } from '../../fixtures/provider-fixtures';
import { waitForNavigationReady } from '../../utils/app-ready';

test.skip(!!process.env.CI, 'Skipping chat tests on CI');

test.describe.serial('Chat page navigation', { tag: '@smoke' }, () => {
  test.beforeEach(async ({ page, navigationBar }) => {
    await waitForNavigationReady(page);
    await navigationBar.navigateToChatPage();
  });

  test('[CHAT-01] All chat UI elements are visible', async ({ chatPage }) => {
    await chatPage.verifyHeaderElementsVisible();
    await chatPage.verifyInputAreaVisible();
    await chatPage.verifySuggestedMessagesVisible();
  });

  test('[CHAT-02] Create and check new chat history item', async ({ chatPage }) => {
    await chatPage.ensureSidebarVisible();
    const initialCount = await chatPage.getChatHistoryCount();
    await chatPage.getSuggestedMessages().last().click();
    await chatPage.waitForChatHistoryCount(initialCount + 1, 15_000);
  });

  test('[CHAT-03] Create and switch between multiple chat sessions without data loss', async ({ chatPage }) => {
    await chatPage.ensureSidebarVisible();
    let messageCount = await chatPage.getChatHistoryCount();

    const chatSessions = [
      { message: 'What is Kubernetes?', expectedIndex: 1 },
      { message: 'Explain Docker containers', expectedIndex: 0 },
    ];

    for (const session of chatSessions) {
      await chatPage.clickNewChat();
      await chatPage.sendMessage(session.message);

      messageCount++;
      await chatPage.waitForChatHistoryCount(messageCount);
    }

    for (const session of chatSessions) {
      await chatPage.clickChatHistoryItemByIndex(session.expectedIndex);
      await chatPage.verifyConversationMessage(session.message);
    }
  });

  test('[CHAT-04] Delete single chat item and then delete all remaining items', async ({ chatPage }) => {
    await chatPage.ensureSidebarVisible();
    const initialCount = await chatPage.getChatHistoryCount();

    await chatPage.deleteChatHistoryItemByIndex(0);
    const expectedCountAfterSingleDelete = initialCount - 1;
    await chatPage.waitForChatHistoryCount(expectedCountAfterSingleDelete);

    await chatPage.deleteAllChatHistoryItems();
    await chatPage.verifyChatHistoryEmpty();

    await chatPage.ensureNotificationsAreNotVisible();
  });

  test('[CHAT-05] Switch between all available models and verify each selection', async ({ chatPage }) => {
    const modelCount = await chatPage.getAvailableModelsCount();

    if (modelCount < 2) {
      test.skip(true, 'Skipping test: Less than 2 models available');
      return;
    }

    const maxModelsToTest = Math.min(modelCount, 3);

    for (let modelIndex = maxModelsToTest - 1; modelIndex >= 0; modelIndex--) {
      await chatPage.selectModelByIndex(modelIndex);
      const selectedModelName = await chatPage.getSelectedModelName();
      expect(selectedModelName).toBeTruthy();

      await chatPage.clickNewChat();

      const testMessage = `Test message for model: ${selectedModelName}`;
      await chatPage.sendMessage(testMessage);
      await chatPage.verifyConversationMessage(testMessage);
    }
  });

  test('[CHAT-06] Change models mid-conversation, verify conversation history is preserved', async ({ chatPage }) => {
    const modelCount = await chatPage.getAvailableModelsCount();

    if (modelCount < 2) {
      test.skip(true, 'Skipping test: Less than 2 models available');
      return;
    }

    await chatPage.ensureSidebarVisible();
    await chatPage.clickNewChat();

    const initialCount = await chatPage.getChatHistoryCount();

    await chatPage.selectModelByIndex(0);
    const firstModelName = await chatPage.getSelectedModelName();
    const firstMessage = 'Hello, how are you?';
    await chatPage.sendMessage(firstMessage);
    await chatPage.verifyConversationMessage(firstMessage);

    const expectedCountAfterFirstMessage = initialCount + 1;
    await chatPage.waitForChatHistoryCount(expectedCountAfterFirstMessage);

    await chatPage.selectModelByIndex(1);
    const secondModelName = await chatPage.getSelectedModelName();
    expect(firstModelName).not.toBe(secondModelName);
    await chatPage.verifyConversationMessage(firstMessage);

    const secondMessage = 'Tell me about AI models';
    await chatPage.sendMessage(secondMessage);

    await chatPage.verifyConversationMessage(firstMessage);
    await chatPage.verifyConversationMessage(secondMessage);
    await chatPage.waitForChatHistoryCount(expectedCountAfterFirstMessage);
  });
});
