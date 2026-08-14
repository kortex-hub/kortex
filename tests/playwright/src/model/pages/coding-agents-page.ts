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

import { BasePage } from './base-page';

export class CodingAgentsPage extends BasePage {
  readonly agentNav: Locator;
  readonly detailHeading: Locator;
  readonly selectedModel: Locator;

  constructor(page: Page) {
    super(page);
    this.agentNav = page.getByRole('navigation', { name: 'Coding agents' });
    this.detailHeading = page.getByRole('heading', { level: 1 });
    this.selectedModel = page.getByTestId('selected-model');
  }

  async waitForLoad(): Promise<void> {
    await expect(this.agentNav).toBeVisible();
  }

  getAgentButton(agentName: string): Locator {
    return this.agentNav.getByRole('button', { name: agentName });
  }

  async selectAgent(agentName: string): Promise<void> {
    await this.getAgentButton(agentName).click();
    await expect(this.detailHeading).toHaveText(agentName);
  }

  async expectDefaultModelSelected(modelLabel: string): Promise<void> {
    await expect(this.selectedModel).toHaveText(`Selected: ${modelLabel}`);
  }
}
