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
import { TIMEOUTS } from 'src/model/core/types';

import { expect, test } from '../../fixtures/provider-fixtures';
import { waitForNavigationReady } from '../../utils/app-ready';

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
    await expect
      .poll(async () => await chatPage.getChatHistoryCount(), { timeout: TIMEOUTS.MODEL_RESPONSE })
      .toBe(initialCount + 1);
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
      await expect
        .poll(async () => await chatPage.getChatHistoryCount(), { timeout: TIMEOUTS.MODEL_RESPONSE })
        .toBe(messageCount);
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

    const modelSwitches = [
      { modelIndex: 0, message: 'Hello, how are you?' },
      { modelIndex: 1, message: 'Tell me about AI models' },
    ];

    const sentMessages: string[] = [];
    const expectedCountAfterFirstMessage = initialCount + 1;

    for (const modelSwitch of modelSwitches) {
      await chatPage.selectModelByIndex(modelSwitch.modelIndex);
      const modelName = await chatPage.getSelectedModelName();
      expect(modelName).toBeTruthy();

      await chatPage.sendMessage(modelSwitch.message);
      sentMessages.push(modelSwitch.message);

      await chatPage.waitForChatHistoryCount(expectedCountAfterFirstMessage);

      for (const message of sentMessages) {
        await chatPage.verifyConversationMessage(message);
      }
    }
  });

  test('[CHAT-07] Export chat as Flow', async ({
    chatPage,
    navigationBar,
    flowsPage,
    resource,
    gooseSetup: _gooseSetup,
  }, testInfo) => {
    // Skip on CI
    test.skip(!!process.env.CI, 'Skipping on CI');

    // Skip for Ollama - flows not yet supported
    if (resource === 'ollama' || testInfo.project.name === 'Ollama-Provider') {
      test.skip(true, 'Flows not supported for Ollama');
      return;
    }
    await chatPage.ensureSidebarVisible();
    await chatPage.clickNewChat();

    const promptForExport =
      'write a typescript recursive method that calculates the fibonacci number for a given index without using memoization';
    // Regex pattern to verify the model response contains recursive Fibonacci code
    const expectedModelResponsePattern = /(\w+)\(\s*(\w+)\s*-\s*1\s*\)\s*\+\s*\1\(\s*\2\s*-\s*2\s*\)/;
    const flowName = 'export-chat-as-flow';

    await chatPage.sendMessage(promptForExport);
    await chatPage.verifyConversationMessage(promptForExport);
    await expect
      .poll(async () => await chatPage.verifyModelConversationMessage(expectedModelResponsePattern), {
        timeout: TIMEOUTS.MODEL_RESPONSE,
        message: 'Model should respond with recursive Fibonacci code pattern',
      })
      .toBeTruthy();

    // Capture the current model name before exporting to verify it's preserved in the flow
    const currentModelName = await chatPage.getSelectedModelName();
    expect(currentModelName).toBeTruthy();

    const flowCreatePage = await chatPage.exportAsFlow();
    await flowCreatePage.waitForLoad();
    await expect(flowCreatePage.selectModelDropdown).toContainText(currentModelName);

    await flowCreatePage.createNewFlow(flowName);
    await navigationBar.navigateToFlowsPage();
    await flowsPage.ensureRowExists(flowName, TIMEOUTS.STANDARD, false);

    await flowsPage.deleteAllFlows();
  });

  test('[CHAT-08] Verify send button state changes during message generation', async ({ chatPage }) => {
    await chatPage.clickNewChat();
    await chatPage.verifySendButtonVisible();

    const message = 'What is Podman?';
    // Pass 0 timeout to avoid waiting for generation to complete before checking stop button
    await chatPage.sendMessage(message, 0);

    await chatPage.verifyStopButtonVisible();
    await chatPage.verifySendButtonHidden();

    await chatPage.verifySendButtonVisible(TIMEOUTS.MODEL_RESPONSE);
    await chatPage.verifyStopButtonHidden();
  });
});
