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

import { TIMEOUTS } from '../core/types';
import { BasePage } from './base-page';

export class SettingsCliPage extends BasePage {
  readonly toolName: Locator;
  readonly gooseVersionLabel: Locator;
  readonly gooseInstallButton: Locator;
  readonly versionDropdownDialog: Locator;
  readonly latestVersion: Locator;

  constructor(page: Page) {
    super(page);
    this.toolName = page.getByLabel('cli-name');
    this.gooseVersionLabel = page.getByLabel('no-cli-version');
    this.gooseInstallButton = page.getByRole('button', { name: 'Install Goose' });
    this.versionDropdownDialog = page.getByLabel('drop-down-dialog');
    this.latestVersion = this.versionDropdownDialog.getByRole('button', { name: /^v\d+\.\d+\.\d+$/ }).first();
  }

  async waitForLoad(): Promise<void> {
    await expect(this.toolName).toBeVisible();
  }

  async isGooseVersionDetected(): Promise<boolean> {
    return !(await this.gooseVersionLabel.isVisible());
  }

  async installGoose(): Promise<void> {
    await expect(this.gooseInstallButton).toBeVisible();
    await this.gooseInstallButton.click();

    await expect(this.versionDropdownDialog).toBeVisible();
    await this.latestVersion.click();

    await expect.poll(async () => await this.isGooseVersionDetected(), { timeout: TIMEOUTS.DEFAULT }).toBeTruthy();
  }
}
