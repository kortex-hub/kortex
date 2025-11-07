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
import { type FlowParameters, TIMEOUTS } from 'src/model/core/types';

import { BasePage } from './base-page';
import { FlowDetailsPage } from './flows-details-page';

export class FlowsCreatePage extends BasePage {
  readonly header: Locator;
  readonly pageContentRegion: Locator;
  readonly heading: Locator;
  readonly nameInputField: Locator;
  readonly selectModelDropdown: Locator;
  readonly descriptionInputField: Locator;
  readonly mcpServerDropdown: Locator;
  readonly promptInputField: Locator;
  readonly instructionInputField: Locator;
  readonly generateButton: Locator;

  constructor(page: Page) {
    super(page);
    this.header = this.page.getByRole('region', { name: 'header' });
    this.heading = this.header.getByRole('heading', { name: 'Flow Create' });

    this.pageContentRegion = this.page.getByRole('region', { name: 'Tab Content' });
    this.nameInputField = this.pageContentRegion.getByPlaceholder('name');
    this.selectModelDropdown = this.pageContentRegion.getByRole('button', { name: 'Select model' });
    this.descriptionInputField = this.pageContentRegion.getByPlaceholder('Description...');
    this.mcpServerDropdown = this.pageContentRegion.getByRole('button', { name: 'Select MCP servers' });
    this.promptInputField = this.pageContentRegion.getByPlaceholder('Prompt');
    this.instructionInputField = this.pageContentRegion.getByPlaceholder('Instruction');
    this.generateButton = this.pageContentRegion.getByRole('button', { name: 'Generate' });
  }

  async waitForLoad(): Promise<void> {
    await expect(this.heading).toBeVisible({ timeout: TIMEOUTS.STANDARD });
  }

  async createNewFlow(
    name: string,
    { description, model, mcpServer, prompt, instruction }: FlowParameters = {},
  ): Promise<FlowDetailsPage> {
    await this.waitForLoad();
    await this.fillFlowForm(name, { description, model, mcpServer, prompt, instruction });

    await this.generateButton.scrollIntoViewIfNeeded();
    await expect(this.generateButton).toBeEnabled();
    await this.generateButton.click();

    return new FlowDetailsPage(this.page, name);
  }

  private async fillFlowForm(name: string, flowParameters?: FlowParameters): Promise<void> {
    await this.waitForFormReady();

    await this.nameInputField.clear();
    await expect(this.nameInputField).toHaveValue('');
    await this.nameInputField.fill(name);
    await expect(this.nameInputField).toHaveValue(name);

    if (!flowParameters) {
      console.log('No flow parameters provided, skipping form fill...');
      return;
    }

    if (flowParameters.description) {
      await this.descriptionInputField.clear();
      await expect(this.descriptionInputField).toHaveValue('');
      await this.descriptionInputField.fill(flowParameters.description);
      await expect(this.descriptionInputField).toHaveValue(flowParameters.description);
    }

    if (flowParameters.model) {
      await expect(this.selectModelDropdown).toBeVisible();
      await this.selectModelDropdown.click();
      await this.page.getByRole('menuitem', { name: flowParameters.model }).click();
      await expect(this.selectModelDropdown).toContainText(flowParameters.model);
    }

    if (flowParameters.mcpServer) {
      await expect(this.mcpServerDropdown).toContainText('0 selected');
      await this.mcpServerDropdown.click();
      await this.page.getByRole('menuitem', { name: flowParameters.mcpServer }).click();
      await expect(this.mcpServerDropdown).toContainText('1 selected');
    }

    if (flowParameters.prompt) {
      await this.promptInputField.clear();
      await expect(this.promptInputField).toHaveValue('');
      await this.promptInputField.fill(flowParameters.prompt);
      await expect(this.promptInputField).toHaveValue(flowParameters.prompt);
    }

    if (flowParameters.instruction) {
      await this.instructionInputField.clear();
      await expect(this.instructionInputField).toHaveValue('');
      await this.instructionInputField.fill(flowParameters.instruction);
      await expect(this.instructionInputField).toHaveValue(flowParameters.instruction);
    }
  }

  private async waitForFormReady(): Promise<void> {
    await expect(this.nameInputField).toBeVisible({ timeout: 15_000 });
    await expect(this.selectModelDropdown).toBeVisible();
    await expect(this.descriptionInputField).toBeVisible();
    await expect(this.mcpServerDropdown).toBeVisible();
    await expect(this.promptInputField).toBeVisible();
    await expect(this.instructionInputField).toBeVisible();
    await expect(this.generateButton).toBeVisible();
  }
}
