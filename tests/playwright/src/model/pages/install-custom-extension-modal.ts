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

import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';

import { BasePage } from './base-page';

export class InstallCustomExtensionModal extends BasePage {
  readonly dialog: Locator;
  readonly imageNameInput: Locator;
  readonly installButton: Locator;
  readonly cancelButton: Locator;
  readonly missingNameError: Locator;

  constructor(page: Page) {
    super(page);
    this.dialog = page.getByRole('dialog', { name: 'Install Custom Extension' });
    this.imageNameInput = page.getByLabel('Image name to install custom extension');
    this.installButton = this.dialog.getByRole('button', { name: 'Install' });
    this.cancelButton = this.dialog.getByRole('button', { name: 'Cancel' });
    this.missingNameError = this.dialog.getByText('Missing name');
  }

  async waitForLoad(): Promise<void> {
    await expect(this.dialog).toBeVisible();
    await expect(this.imageNameInput).toBeVisible();
  }

  async fillImageName(name: string): Promise<void> {
    await this.imageNameInput.fill(name);
  }

  async cancel(): Promise<void> {
    await expect(this.cancelButton).toBeEnabled();
    await this.cancelButton.click();
    await expect(this.dialog).not.toBeVisible();
  }
}
