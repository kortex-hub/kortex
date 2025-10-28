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
import type { ProxyConfigurationOption } from 'src/model/core/types';
import { proxyConfigurations } from 'src/model/core/types';

import { BasePage } from './base-page';

export class SettingsProxyPage extends BasePage {
  readonly proxyConfigDropdown: Locator;
  readonly httpProxyField: Locator;
  readonly httpsProxyField: Locator;
  readonly noProxyField: Locator;
  readonly proxyUpdateButton: Locator;

  constructor(page: Page) {
    super(page);
    this.proxyConfigDropdown = page.locator('#toggle-proxy');
    this.httpProxyField = page.locator('#httpProxy');
    this.httpsProxyField = page.locator('#httpsProxy');
    this.noProxyField = page.locator('#noProxy');
    this.proxyUpdateButton = page.getByRole('button', { name: 'Update' });
  }

  async waitForLoad(): Promise<void> {
    await expect(this.proxyConfigDropdown).toBeVisible();
  }

  getProxyFields(): Locator[] {
    return [this.httpProxyField, this.httpsProxyField, this.noProxyField];
  }

  getProxyConfigOption(option: ProxyConfigurationOption): Locator {
    return this.page.getByRole('button', { name: option, exact: true });
  }

  async verifyProxyConfigurationOptions(): Promise<void> {
    await expect(this.proxyConfigDropdown).toBeVisible();
    await this.proxyConfigDropdown.click();
    for (const config of proxyConfigurations) {
      await expect(this.getProxyConfigOption(config.option)).toBeVisible();
    }
    await this.proxyConfigDropdown.click();
  }

  async selectProxyConfigurationAndVerifyFields(
    option: ProxyConfigurationOption,
    shouldBeEditable: boolean,
  ): Promise<void> {
    await this.proxyConfigDropdown.click();
    await this.getProxyConfigOption(option).click();
    for (const field of this.getProxyFields()) {
      if (shouldBeEditable) {
        await expect(field).toBeEditable();
      } else {
        await expect(field).toBeDisabled();
      }
    }
    await expect(this.proxyUpdateButton).toBeVisible();
    await expect(this.proxyUpdateButton).toBeEnabled();
  }
}
