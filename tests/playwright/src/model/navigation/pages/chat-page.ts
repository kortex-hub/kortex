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

import { BasePage } from './base-page';

export class ChatPage extends BasePage {
  readonly toggleSidebarButton: Locator;
  readonly mcpDropdown: Locator;
  readonly newChatButton: Locator;
  readonly sidebarNewChatButton: Locator;
  readonly modelDropdownSelector: Locator;
  readonly messageField: Locator;
  readonly sendButton: Locator;
  readonly suggestedMessagesGrid: Locator;
  readonly chatHistoryItems: Locator;

  constructor(page: Page) {
    super(page);
    this.toggleSidebarButton = page.getByRole('button', { name: 'Toggle sidebar' });
    this.mcpDropdown = page.getByRole('button', { name: 'Select MCP servers' });
    this.newChatButton = page.getByRole('button', { name: 'New Chat' });
    this.sidebarNewChatButton = page.locator('[data-sidebar="header"] button[data-tooltip-trigger]').first();
    this.modelDropdownSelector = page.getByRole('button', { name: 'Select model' });
    this.messageField = page.getByPlaceholder('Send a message...');
    this.sendButton = page.getByRole('button', { name: 'Send message' });
    this.suggestedMessagesGrid = page.getByRole('region', { name: 'Suggested prompts' });
    this.chatHistoryItems = page.locator('li[data-sidebar="menu-item"]');
  }

  async waitForLoad(): Promise<void> {
    await expect(this.messageField).toBeVisible({ timeout: 10_000 });
    await expect(this.toggleSidebarButton).toBeVisible({ timeout: 10_000 });
  }

  getSuggestedMessages(): Locator {
    return this.suggestedMessagesGrid.getByRole('button');
  }

  async verifyHeaderElementsVisible(): Promise<void> {
    await expect(this.toggleSidebarButton).toBeVisible();
    await expect(this.mcpDropdown).toBeVisible();
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

  async verifySidebarVisible(): Promise<void> {
    await expect(this.chatHistoryItems.first()).toBeVisible({ timeout: 2_000 });
  }

  async verifySidebarHidden(): Promise<void> {
    await expect(this.chatHistoryItems.first()).not.toBeVisible({ timeout: 2_000 });
  }

  async toggleSidebar(): Promise<void> {
    await this.toggleSidebarButton.click();
    await this.page.waitForTimeout(1_000);
  }

  async sendMessage(message: string): Promise<void> {
    await this.messageField.fill(message);
    await this.sendButton.click();
  }

  async waitForResponse(timeout = 5_000): Promise<void> {
    await this.page.waitForTimeout(timeout);
  }

  async clickNewChat(): Promise<void> {
    const isSidebarOpen = await this.chatHistoryItems.isVisible();
    if (isSidebarOpen) {
      await this.sidebarNewChatButton.click();
    } else {
      await this.newChatButton.click();
    }
    await expect(this.suggestedMessagesGrid).toBeVisible({ timeout: 5_000 });
  }

  async getChatHistoryCount(): Promise<number> {
    await this.page.waitForTimeout(5_000);
    return await this.chatHistoryItems.count();
  }
}
