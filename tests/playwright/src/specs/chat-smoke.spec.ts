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
import { expect, test } from '../fixtures/chat-fixtures';
import { NavigationBar } from '../model/navigation/navigation';
import { ChatPage } from '../model/navigation/pages/chat-page';
import { waitForNavigationReady } from '../utils/app-ready';
import { hasApiKey, PROVIDERS } from '../utils/resource-helper';

let navigationBar: NavigationBar;
let chatPage: ChatPage;

test.describe('Chat page navigation', { tag: '@smoke' }, () => {
  test.beforeAll(async ({ resource }) => {
    if (process.env.CI) {
      test.skip(true, 'Skipping chat test on CI');
    }
    if (!hasApiKey(resource)) {
      const provider = PROVIDERS[resource];
      test.skip(true, `${provider.envVarName} environment variable is not set`);
    }
  });

  test.beforeEach(async ({ page }) => {
    navigationBar = new NavigationBar(page);
    await waitForNavigationReady(page);
    await navigationBar.chatLink.click();
    chatPage = new ChatPage(page);
    await chatPage.waitForLoad();
  });

  test('[CHAT-01] All chat UI elements are visible', async () => {
    await chatPage.verifyHeaderElementsVisible();
    await chatPage.verifyInputAreaVisible();
    await chatPage.verifySuggestedMessagesVisible();
  });

  test('[CHAT-02] Create and check new chat history item', async () => {
    await chatPage.toggleSidebar();
    const initialCount = await chatPage.getChatHistoryCount();
    await chatPage.toggleSidebar();
    const suggestedMessages = chatPage.getSuggestedMessages();
    await suggestedMessages.last().click();
    await chatPage.waitForResponse();
    await chatPage.toggleSidebar();
    await chatPage.verifySidebarVisible();
    const newCount = await chatPage.getChatHistoryCount();
    expect(newCount).toBeGreaterThan(initialCount);
  });
});
