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

import { expect, type Locator, type Page } from '@playwright/test';
import { clearAllToasts, handleDialogIfPresent } from 'src/utils/app-ready';

import { TIMEOUTS } from '../core/types';
import { BasePage } from './base-page';
import { FlowsCreatePage } from './flows-create-page';

export class ChatPage extends BasePage {
  readonly toggleSidebarButton: Locator;
  readonly newChatButton: Locator;
  readonly sidebarNewChatButton: Locator;
  readonly deleteAllChatsButton: Locator;
  readonly modelDropdownSelector: Locator;
  readonly messageField: Locator;
  readonly sendButton: Locator;
  readonly suggestedMessagesGrid: Locator;
  readonly chatHistoryItems: Locator;
  readonly conversationMessages: Locator;
  readonly conversationMessageParagraphs: Locator;
  readonly userConversationMessages: Locator;
  readonly modelConversationMessages: Locator;
  readonly chatHistoryItem: Locator;
  readonly chatHistoryItemMenuAction: Locator;
  readonly chatHistoryItemDeleteButton: Locator;
  readonly chatHistoryItemRenameButton: Locator;
  readonly chatHistoryEmptyMessage: Locator;
  readonly toasts: Locator;
  readonly modelDropdownContent: Locator;
  readonly modelMenuItems: Locator;
  readonly activeModelMenuItem: Locator;
  readonly exportAsFlowButton: Locator;
  readonly stopButton: Locator;
  readonly toolsSelectionButton: Locator;
  readonly configureMcpServersButton: Locator;
  readonly hideMcpPanelButton: Locator;
  readonly showMcpPanelButton: Locator;
  readonly filterToolsInput: Locator;
  readonly toolCheckboxes: Locator;
  readonly editCancelHint: Locator;

  constructor(page: Page) {
    super(page);
    this.toggleSidebarButton = page.getByRole('button', { name: 'Toggle sidebar' });
    this.newChatButton = page.getByRole('button', { name: 'New Chat' });
    this.sidebarNewChatButton = page.locator('[data-sidebar="header"] button[data-tooltip-trigger]').first();
    this.deleteAllChatsButton = page.getByRole('button', { name: 'Delete all chats' });
    this.modelDropdownSelector = page.getByRole('button', { name: 'Select model' });
    this.messageField = page.getByPlaceholder('Send a message...');
    this.sendButton = page.getByRole('button', { name: 'Send message' });
    this.suggestedMessagesGrid = page.getByRole('region', { name: 'Suggested prompts' });
    this.chatHistoryItems = page.locator('li[data-sidebar="menu-item"]');
    this.conversationMessages = page.locator('div[data-role]');
    this.conversationMessageParagraphs = this.conversationMessages.getByRole('paragraph');
    this.userConversationMessages = page.locator('div[data-role="user"]');
    this.modelConversationMessages = page.locator('div[data-role="assistant"]');
    this.chatHistoryItem = page.locator('button[data-sidebar="menu-button"]');
    this.chatHistoryItemMenuAction = page.locator('button[data-sidebar="menu-action"]');
    this.chatHistoryItemDeleteButton = page.getByRole('menuitem', { name: 'Delete' });
    this.chatHistoryItemRenameButton = page.getByRole('menuitem', { name: 'Rename' });
    this.chatHistoryEmptyMessage = page.getByText('Your conversations will appear here once you start chatting!');
    this.toasts = page.locator('[data-sonner-toast]');
    this.modelDropdownContent = page.locator('[data-slot="dropdown-menu-content"]');
    this.modelMenuItems = this.modelDropdownContent.getByRole('menuitem');
    this.activeModelMenuItem = this.modelDropdownContent.locator('[role="menuitem"][data-active="true"]');
    this.exportAsFlowButton = page.getByRole('button', { name: 'Export as Flow' });
    this.stopButton = page.getByRole('button', { name: 'Stop generation' });
    this.toolsSelectionButton = page.getByRole('button', { name: 'Tools Selection' });
    this.configureMcpServersButton = page.getByRole('button', { name: 'Configure MCP servers' });
    this.hideMcpPanelButton = page.getByRole('button', { name: 'Hide MCP panel' });
    this.showMcpPanelButton = page.getByRole('button', { name: 'Show MCP panel' });
    this.filterToolsInput = page.getByLabel('filter Tools');
    this.toolCheckboxes = page.getByRole('checkbox');
    this.editCancelHint = page.getByText('Press ESC to cancel editing');
  }

  async waitForLoad(): Promise<void> {
    await expect(this.messageField).toBeVisible({ timeout: 10_000 });
    await expect(this.toggleSidebarButton).toBeVisible({ timeout: 10_000 });
  }

  getSuggestedMessages(): Locator {
    return this.suggestedMessagesGrid.getByRole('button');
  }

  getConversationMessage(message: string): Locator {
    return this.conversationMessageParagraphs.getByText(message, { exact: true });
  }

  async verifyHeaderElementsVisible(): Promise<void> {
    await expect(this.toggleSidebarButton).toBeVisible();
    await expect(this.newChatButton).toBeVisible();
    await expect(this.modelDropdownSelector).toBeVisible();
  }

  async verifyInputAreaVisible(): Promise<void> {
    await expect(this.messageField).toBeVisible();
    await expect(this.sendButton).toBeVisible();
  }

  async verifySuggestedMessagesVisible(minCount = 4): Promise<void> {
    const suggestedMessages = this.getSuggestedMessages();
    const count = await suggestedMessages.count();
    expect(count).toBeGreaterThanOrEqual(minCount);
    for (let i = 0; i < minCount; i++) {
      await expect(suggestedMessages.nth(i)).toBeVisible();
    }
  }

  async ensureChatSidebarVisible(): Promise<void> {
    const isSidebarOpen = await this.sidebarNewChatButton.isVisible();
    if (!isSidebarOpen) {
      await this.toggleSidebarButton.click();
      await expect(this.sidebarNewChatButton).toBeVisible();
    }
  }

  async ensureChatSidebarHidden(): Promise<void> {
    const isSidebarOpen = await this.sidebarNewChatButton.isVisible();
    if (isSidebarOpen) {
      await this.toggleSidebarButton.click();
      await expect(this.sidebarNewChatButton).not.toBeVisible();
    }
  }

  async sendMessage(
    message: string,
    { waitForMessage = true, timeout = TIMEOUTS.SHORT }: { waitForMessage?: boolean; timeout?: number } = {},
  ): Promise<void> {
    await this.messageField.fill(message);
    await expect(this.messageField).toHaveValue(message);
    if (await this.stopButton.isVisible()) {
      await expect(this.stopButton).not.toBeVisible({ timeout: TIMEOUTS.MODEL_RESPONSE });
    }
    await expect(this.sendButton).toBeEnabled();
    await this.sendButton.click();
    if (waitForMessage) {
      await expect(this.getConversationMessage(message)).toBeVisible({ timeout });
    }
  }

  async clickNewChat(): Promise<void> {
    const isSidebarOpen = await this.sidebarNewChatButton.isVisible();
    if (isSidebarOpen) {
      await this.sidebarNewChatButton.click();
    } else {
      await this.newChatButton.click();
    }
    await expect(this.suggestedMessagesGrid).toBeVisible();
  }

  async getChatHistoryCount(): Promise<number> {
    return await this.chatHistoryItems.count();
  }

  async clickChatHistoryItemByIndex(index: number): Promise<void> {
    await this.chatHistoryItems.nth(index).locator(this.chatHistoryItem).click();
  }

  async deleteChatHistoryItemByIndex(index: number): Promise<void> {
    const item = this.chatHistoryItems.nth(index);
    await item.locator(this.chatHistoryItemMenuAction).click();
    await this.chatHistoryItemDeleteButton.click();
    await handleDialogIfPresent(this.page);
  }

  async deleteAllChatHistoryItems(): Promise<void> {
    await this.deleteAllChatsButton.click();
    await handleDialogIfPresent(this.page);
  }

  async renameChatHistoryItemByIndex(index: number, newTitle: string): Promise<void> {
    const item = this.chatHistoryItems.nth(index);
    await item.locator(this.chatHistoryItemMenuAction).click();
    await this.chatHistoryItemRenameButton.click();

    // Find the input field using accessible label
    const inputField = item.getByLabel('Rename conversation');
    await expect(inputField).toBeVisible();
    await inputField.fill(newTitle);
    await inputField.press('Enter');
  }

  async cancelRenameChatHistoryItemByIndex(index: number, textBeforeCancel?: string): Promise<void> {
    const item = this.chatHistoryItems.nth(index);
    await item.locator(this.chatHistoryItemMenuAction).click();
    await this.chatHistoryItemRenameButton.click();

    // Find the input field using accessible label
    const inputField = item.getByLabel('Rename conversation');
    await expect(inputField).toBeVisible();

    // Optionally fill text before canceling (to test that changes are discarded)
    if (textBeforeCancel) {
      await inputField.fill(textBeforeCancel);
    }

    await inputField.press('Escape');

    // Verify the input is no longer visible
    await expect(inputField).not.toBeVisible();
  }

  async getChatHistoryItemTitle(index: number): Promise<string> {
    const item = this.chatHistoryItems.nth(index);
    const title = await item.locator(this.chatHistoryItem).textContent();
    return title?.trim() ?? '';
  }

  async waitForChatHistoryCount(expectedCount: number, timeout = 10_000): Promise<void> {
    await expect(this.chatHistoryItems).toHaveCount(expectedCount, { timeout });
  }

  async verifyChatHistoryEmpty(): Promise<void> {
    await expect(this.chatHistoryEmptyMessage).toBeVisible();
  }

  async verifyConversationMessage(message: string, timeout = TIMEOUTS.SHORT): Promise<void> {
    await expect(this.getConversationMessage(message)).toBeVisible({ timeout });
  }

  async verifyModelConversationMessage(textOrRegex: string | RegExp): Promise<boolean> {
    const messagesLocators = await this.modelConversationMessages.all();

    for (const messageLocator of messagesLocators) {
      const message = await messageLocator.textContent();
      if (message?.match(textOrRegex)) {
        return true;
      }
    }
    return false;
  }

  async ensureNotificationsAreNotVisible(): Promise<void> {
    await clearAllToasts(this.page, this.toasts);
  }

  async getAvailableModelsCount(): Promise<number> {
    await this.modelDropdownSelector.click();
    await expect(this.modelDropdownContent).toBeVisible();
    const count = await this.modelMenuItems.count();
    await this.page.keyboard.press('Escape');
    return count;
  }

  async getChatModelNames(): Promise<string[]> {
    await this.modelDropdownSelector.click();
    await expect(this.modelDropdownContent).toBeVisible();
    try {
      const count = await this.modelMenuItems.count();
      const modelNames: string[] = [];
      for (let i = 0; i < count; i++) {
        const text = await this.modelMenuItems.nth(i).textContent();
        if (text && !text.toLowerCase().includes('embed')) {
          modelNames.push(text.trim());
        }
      }
      return modelNames;
    } finally {
      await this.page.keyboard.press('Escape');
    }
  }

  async selectModelByIndex(index: number): Promise<void> {
    await this.modelDropdownSelector.click();
    await expect(this.modelDropdownContent).toBeVisible();
    const modelItem = this.modelMenuItems.nth(index);
    await expect(modelItem).toBeVisible();
    await modelItem.click();
  }

  async selectModelByName(modelName: string): Promise<void> {
    await this.modelDropdownSelector.click();
    await expect(this.modelDropdownContent).toBeVisible();
    const modelItem = this.modelDropdownContent.getByRole('menuitem', { name: modelName, exact: true });
    await expect(modelItem).toBeVisible();
    await modelItem.click();
  }

  async getSelectedModelName(): Promise<string> {
    await this.modelDropdownSelector.click();
    await expect(this.modelDropdownContent).toBeVisible();
    const text = await this.activeModelMenuItem.textContent();
    await this.page.keyboard.press('Escape');
    return text?.trim() ?? '';
  }

  async verifySendButtonVisible(timeout = 10_000): Promise<void> {
    await expect(this.sendButton).toBeVisible({ timeout });
  }

  async verifySendButtonHidden(timeout = 10_000): Promise<void> {
    await expect(this.sendButton).not.toBeVisible({ timeout });
  }

  async verifyStopButtonVisible(timeout = 10_000): Promise<void> {
    await expect(this.stopButton).toBeVisible({ timeout });
  }

  async verifyStopButtonHidden(timeout = 10_000): Promise<void> {
    await expect(this.stopButton).not.toBeVisible({ timeout });
  }

  async exportAsFlow(): Promise<FlowsCreatePage> {
    await expect(this.exportAsFlowButton).toBeEnabled({ timeout: TIMEOUTS.STANDARD });
    await this.exportAsFlowButton.click();
    await expect(this.exportAsFlowButton).not.toBeVisible({ timeout: TIMEOUTS.STANDARD });

    return new FlowsCreatePage(this.page);
  }

  async ensureToolsSidebarVisible(): Promise<void> {
    const isSidebarOpen = await this.hideMcpPanelButton.isVisible();
    if (isSidebarOpen) {
      return;
    }

    const toggleButton = (await this.toolsSelectionButton.isVisible())
      ? this.toolsSelectionButton
      : this.showMcpPanelButton;
    await toggleButton.click();
    await expect(this.hideMcpPanelButton).toBeVisible();
  }

  async ensureToolsSidebarHidden(): Promise<void> {
    const isSidebarOpen = await this.hideMcpPanelButton.isVisible();
    if (isSidebarOpen) {
      await this.hideMcpPanelButton.click();
      await expect(this.hideMcpPanelButton).not.toBeVisible();
    }
  }

  async filterTools(term: string): Promise<void> {
    await this.filterToolsInput.fill(term);
  }

  getMcpServerLabel(serverName: string): Locator {
    return this.page.getByText(serverName);
  }

  async getToolCount(): Promise<number> {
    return this.toolCheckboxes.count();
  }

  getToolByName(name: string): Locator {
    return this.page.getByText(name, { exact: true });
  }

  async waitForModelResponse(): Promise<void> {
    await expect(this.modelConversationMessages.first()).toBeVisible({ timeout: TIMEOUTS.MODEL_RESPONSE });
    await this.verifySendButtonVisible(TIMEOUTS.MODEL_RESPONSE);
  }

  async clickEditOnUserMessage(messageText: string): Promise<void> {
    const messageLocator = this.userConversationMessages.filter({ hasText: messageText });
    await messageLocator.hover();
    await messageLocator.getByLabel('Edit message').click({ force: true });
  }

  async verifyEditingMode(originalText: string): Promise<void> {
    await expect(this.editCancelHint).toBeVisible();
    await expect(this.messageField).toHaveValue(originalText);
  }

  async cancelEditing(): Promise<void> {
    await this.page.keyboard.press('Escape');
    await expect(this.editCancelHint).not.toBeVisible();
  }

  async verifyMessagesAfterEditAreDimmed(editedMessageText: string): Promise<void> {
    const allMessages = await this.conversationMessages.all();

    let editedGlobalIndex = -1;
    for (let i = 0; i < allMessages.length; i++) {
      const text = await allMessages[i].textContent();
      if (text?.includes(editedMessageText)) {
        editedGlobalIndex = i;
        break;
      }
    }

    expect(editedGlobalIndex).toBeGreaterThan(-1);

    for (let i = editedGlobalIndex + 1; i < allMessages.length; i++) {
      await expect(allMessages[i]).toHaveClass(/opacity-40/);
    }
  }

  async verifyMessagesAfterEditAreNotDimmed(): Promise<void> {
    const allMessages = await this.conversationMessages.all();
    for (const message of allMessages) {
      await expect(message).not.toHaveClass(/opacity-40/);
    }
  }

  async submitEditedMessage(newText: string): Promise<void> {
    await this.messageField.clear();
    await this.messageField.fill(newText);
    if (await this.stopButton.isVisible()) {
      await expect(this.stopButton).not.toBeVisible({ timeout: TIMEOUTS.MODEL_RESPONSE });
    }
    await expect(this.sendButton).toBeEnabled();
    await this.sendButton.click();
  }
}
