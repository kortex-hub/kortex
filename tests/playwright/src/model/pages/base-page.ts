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

export abstract class BasePage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  protected async openTab<T extends BasePage>(
    button: Locator,
    PageClass: new (page: Page) => T,
    timeout = 10_000,
  ): Promise<T> {
    await expect(button).toBeEnabled({ timeout });
    await button.click({ timeout });

    const pageInstance = new PageClass(this.page);
    await pageInstance.waitForLoad();
    return pageInstance;
  }

  abstract waitForLoad(): Promise<void>;
}
