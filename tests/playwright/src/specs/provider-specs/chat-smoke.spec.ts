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
import { test } from '../../fixtures/provider-fixtures';
import type { ChatPage } from '../../model/pages/chat-page';
import { waitForNavigationReady } from '../../utils/app-ready';
import { hasApiKey, PROVIDERS } from '../../utils/resource-helper';

let chatPage: ChatPage;

test.describe.serial('Chat page navigation', { tag: '@smoke' }, () => {
  test.beforeAll(async ({ resource }) => {
    if (process.env.CI) {
      test.skip(true, 'Skipping chat test on CI');
    }
    if (!hasApiKey(resource)) {
      const provider = PROVIDERS[resource];
      test.skip(true, `${provider.envVarName} environment variable is not set`);
    }
  });

  test.beforeEach(async ({ page, navigationBar }) => {
    await waitForNavigationReady(page);
    chatPage = await navigationBar.navigateToChatPage();
  });

  test('[CHAT-01] All chat UI elements are visible', async () => {
    await chatPage.verifyHeaderElementsVisible();
    await chatPage.verifyInputAreaVisible();
    await chatPage.verifySuggestedMessagesVisible();
  });

  test('[CHAT-02] Create and check new chat history item', async () => {
    await chatPage.ensureSidebarVisible();
    let expectedCount = await chatPage.getChatHistoryCount();
    const suggestedMessages = chatPage.getSuggestedMessages();
    await suggestedMessages.last().click();
    await chatPage.waitForResponse();
    expectedCount++;
    await chatPage.waitForChatHistoryCount(expectedCount);
  });

  test('[CHAT-03] Create and switch between multiple chat sessions without data loss', async () => {
    await chatPage.ensureSidebarVisible();
    let expectedCount = await chatPage.getChatHistoryCount();

    await chatPage.clickNewChat();
    const firstMessage = 'What is Kubernetes?';
    await chatPage.sendMessage(firstMessage);
    expectedCount++;
    await chatPage.waitForChatHistoryCount(expectedCount);

    await chatPage.clickNewChat();
    const secondMessage = 'Explain Docker containers';
    await chatPage.sendMessage(secondMessage);
    expectedCount++;
    await chatPage.waitForChatHistoryCount(expectedCount);

    await chatPage.clickChatHistoryItemByIndex(1);
    await chatPage.verifyConversationMessage(firstMessage);

    await chatPage.clickChatHistoryItemByIndex(0);
    await chatPage.verifyConversationMessage(secondMessage);
  });

  test('[CHAT-04] Delete single chat item and then delete all remaining items', async () => {
    await chatPage.ensureSidebarVisible();
    let expectedCount = await chatPage.getChatHistoryCount();

    await chatPage.deleteChatHistoryItemByIndex(0);
    expectedCount--;
    await chatPage.waitForChatHistoryCount(expectedCount);

    await chatPage.deleteAllChatHistoryItems();
    await chatPage.verifyChatHistoryEmpty();

    await chatPage.ensureNotificationsAreNotVisible();
  });

  test('[CHAT-05] Switch between all available models and verify each selection', async () => {
    const modelCount = await chatPage.getAvailableModelsCount();

    test.skip(modelCount < 2, 'Skipping test: Less than 2 models available');

    const modelsToTest = Math.min(modelCount, 3);

    for (let i = 1; i < modelsToTest; i++) {
      await chatPage.selectModelByIndex(i);
      const selectedModel = await chatPage.getSelectedModelName();
      await chatPage.clickNewChat();
      const testMessage = `Test message for ${selectedModel}`;
      await chatPage.sendMessage(testMessage);
      await chatPage.verifyConversationMessage(testMessage);
    }
  });
});
