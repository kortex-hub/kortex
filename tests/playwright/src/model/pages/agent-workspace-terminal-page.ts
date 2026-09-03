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

import { expect, type Locator, type Page } from '@playwright/test';

import { TIMEOUTS } from '/@/model/core/types';

import { BasePage } from './base-page';

export class AgentWorkspaceTerminalPage extends BasePage {
  readonly tabContentRegion: Locator;
  readonly terminalContainer: Locator;
  readonly emptyTerminalMessage: Locator;

  private static readonly ANTHROPIC_API_KEY_PROMPT = /Do you want to use this API key\?/i;
  private static readonly ANTHROPIC_API_KEY_YES_SELECTED = />\s*1\.\s*Yes/i;
  /** Offset from bottom of xterm screen to target the last visible row. */
  private static readonly XTERM_BOTTOM_ROW_OFFSET_PX = 24;

  constructor(page: Page) {
    super(page);
    this.tabContentRegion = this.page.getByRole('region', { name: 'Tab Content' });
    this.terminalContainer = this.tabContentRegion.locator('.xterm-rows');
    this.emptyTerminalMessage = this.tabContentRegion.getByText('Workspace is not running');
  }

  async waitForLoad(): Promise<void> {
    await expect(this.terminalContainer.or(this.emptyTerminalMessage)).toBeVisible({
      timeout: TIMEOUTS.WORKSPACE_READY,
    });
  }

  async waitForTerminalContent(
    textOrRegex: string | RegExp,
    timeout: number = TIMEOUTS.WORKSPACE_READY,
  ): Promise<void> {
    const matches = (text: string): boolean =>
      typeof textOrRegex === 'string' ? text.includes(textOrRegex) : textOrRegex.test(text);

    await expect
      .poll(
        async () => {
          const text = await this.getTerminalText();
          await this.dismissAnthropicApiKeyPromptIfVisible(text);
          return matches(text);
        },
        {
          timeout,
          message: `Terminal did not show expected content: ${String(textOrRegex)}`,
        },
      )
      .toBe(true);
  }

  /**
   * Claude Code may prompt to use ANTHROPIC_API_KEY from the sandbox environment.
   * Select "Yes" when the prompt is visible so the agent session can start.
   */
  async dismissAnthropicApiKeyPromptIfVisible(preReadText?: string): Promise<void> {
    const text = preReadText ?? (await this.getTerminalText());
    if (!AgentWorkspaceTerminalPage.ANTHROPIC_API_KEY_PROMPT.test(text)) {
      return;
    }

    await this.focusTerminalInput();

    const yesSelected = AgentWorkspaceTerminalPage.ANTHROPIC_API_KEY_YES_SELECTED.test(text);
    if (!yesSelected) {
      // Default highlight is "No (recommended)" — move up to "Yes".
      await this.page.keyboard.press('ArrowUp');
    }

    // Send Enter immediately — no poll/read between ArrowUp and Enter (that breaks xterm focus).
    await this.page.keyboard.press('Enter');

    await expect
      .poll(async () => !AgentWorkspaceTerminalPage.ANTHROPIC_API_KEY_PROMPT.test(await this.getTerminalText()), {
        timeout: TIMEOUTS.STANDARD,
        message: 'Anthropic API key prompt did not dismiss after selecting Yes',
      })
      .toBe(true);
  }

  async getTerminalText(): Promise<string> {
    const inner = await this.terminalContainer.innerText().catch(() => '');
    if (inner.trim()) {
      return inner;
    }
    return (await this.terminalContainer.textContent()) ?? '';
  }

  /** Focus the xterm input. OpenCode's prompt sits at the bottom — avoid clicking the top rows. */
  async focusTerminalInput(): Promise<Locator> {
    const textarea = this.tabContentRegion.locator('textarea.xterm-helper-textarea');
    await expect(textarea).toBeAttached({ timeout: TIMEOUTS.SHORT });
    await textarea.evaluate(el => (el as HTMLTextAreaElement).focus());

    const screen = this.tabContentRegion.locator('.xterm-screen');
    const box = await screen.boundingBox();
    if (box) {
      await this.page.mouse.click(
        box.x + box.width / 2,
        box.y + box.height - AgentWorkspaceTerminalPage.XTERM_BOTTOM_ROW_OFFSET_PX,
      );
    } else {
      await textarea.click();
    }
    return textarea;
  }

  async sendPrompt(options: { prompt: string; expectedResponse?: string | RegExp; timeout?: number }): Promise<void> {
    const { prompt, expectedResponse, timeout = TIMEOUTS.MODEL_RESPONSE } = options;

    await this.dismissAnthropicApiKeyPromptIfVisible();

    const textarea = await this.focusTerminalInput();
    await textarea.pressSequentially(prompt, { delay: 50 });
    await textarea.press('Enter');

    if (expectedResponse) {
      await this.waitForTerminalContent(expectedResponse, timeout);
    }
  }
}
