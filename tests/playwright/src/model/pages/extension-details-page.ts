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

import { Button } from '/@/model/core/types';

import { BasePage } from './base-page';

export class ExtensionDetailsPage extends BasePage {
  readonly header: Locator;
  readonly heading: Locator;
  readonly deleteButton: Locator;
  readonly status: Locator;

  constructor(page: Page, extensionName: string) {
    super(page);
    this.header = page.getByRole('region', { name: 'Header' });
    this.heading = this.header.getByRole('heading', { name: `${extensionName} extension`, exact: true });
    this.deleteButton = this.header.getByLabel(Button.DELETE);
    this.status = this.header.getByLabel('Extension Status Label');
  }

  async waitForLoad(): Promise<void> {
    await expect(this.heading).toBeVisible();
    await expect(this.status).toBeVisible();
  }
}
