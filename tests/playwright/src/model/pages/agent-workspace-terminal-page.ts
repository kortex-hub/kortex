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
import { TIMEOUTS } from 'src/model/core/types';

import { BasePage } from './base-page';

export class AgentWorkspaceTerminalPage extends BasePage {
  readonly tabContentRegion: Locator;
  readonly terminalContainer: Locator;
  readonly emptyTerminalMessage: Locator;

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
    await expect(this.terminalContainer).toContainText(textOrRegex, { timeout });
  }

  async getTerminalText(): Promise<string> {
    return (await this.terminalContainer.textContent()) ?? '';
  }

  async sendPrompt(options: { prompt: string; expectedResponse?: string | RegExp; timeout?: number }): Promise<void> {
    const { prompt, expectedResponse, timeout = TIMEOUTS.MODEL_RESPONSE } = options;

    const textarea = this.tabContentRegion.locator('textarea.xterm-helper-textarea');
    await expect(textarea).toBeAttached({ timeout: TIMEOUTS.SHORT });
    await textarea.evaluate(el => (el as HTMLTextAreaElement).focus());

    const contentBefore = await this.getTerminalText();
    await this.page.keyboard.type(prompt, { delay: 50 });
    await expect
      .poll(() => this.getTerminalText(), {
        timeout: TIMEOUTS.SHORT,
        message: `Typed text "${prompt}" did not appear in the terminal`,
      })
      .not.toBe(contentBefore);

    await this.page.keyboard.press('Enter');

    if (expectedResponse) {
      const contentAfterSubmit = await this.getTerminalText();
      await expect
        .poll(() => this.getTerminalText(), {
          timeout,
          message: 'Terminal content did not change after pressing Enter',
        })
        .not.toBe(contentAfterSubmit);
      await this.waitForTerminalContent(expectedResponse, timeout);
    }
  }
}
