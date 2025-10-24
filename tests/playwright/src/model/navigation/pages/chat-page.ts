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
  readonly modelDropdownSelector: Locator;
  readonly messageField: Locator;
  readonly sendButton: Locator;
  readonly suggestedMessagesGrid: Locator;

  constructor(page: Page) {
    super(page);
    this.toggleSidebarButton = page.getByRole('button', { name: 'Toggle sidebar' });
    this.mcpDropdown = page.getByRole('button', { name: 'Select MCP servers' });
    this.newChatButton = page.getByRole('button', { name: 'New Chat' });
    this.modelDropdownSelector = page.getByRole('button', { name: 'Select model' });
    this.messageField = page.getByPlaceholder('Send a message...');
    this.sendButton = page.getByRole('button', { name: 'Send message' });
    this.suggestedMessagesGrid = page.getByRole('region', { name: 'Suggested prompts' });
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
    for (let i = 0; i < Math.min(count, minCount); i++) {
      await expect(suggestedMessages.nth(i)).toBeVisible();
    }
  }
}
