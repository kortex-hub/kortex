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

import type { Locator, Page } from '@playwright/test';

import { BasePage } from './base-page';
import { CliTabPage } from './settings-cli-tab-page';
import { PreferencesTabPage } from './settings-preferences-tab-page';
import { ProxyTabPage } from './settings-proxy-tab-page';
import { ResourcesTabPage } from './settings-resources-tab-page';

export class SettingsPage extends BasePage {
  readonly resourcesTab: Locator;
  readonly cliTab: Locator;
  readonly proxyTab: Locator;
  readonly preferencesTab: Locator;

  constructor(page: Page) {
    super(page);
    this.resourcesTab = page.getByRole('link', { name: 'Resources' });
    this.cliTab = page.getByRole('link', { name: 'CLI' });
    this.proxyTab = page.getByRole('link', { name: 'Proxy' });
    this.preferencesTab = page.getByRole('link', { name: 'Preferences' });
  }

  get resourcesPage(): ResourcesTabPage {
    return new ResourcesTabPage(this.page);
  }

  get cliPage(): CliTabPage {
    return new CliTabPage(this.page);
  }

  get proxyPage(): ProxyTabPage {
    return new ProxyTabPage(this.page);
  }

  get preferencesPage(): PreferencesTabPage {
    return new PreferencesTabPage(this.page);
  }

  getAllTabs(): Locator[] {
    return [this.resourcesTab, this.cliTab, this.proxyTab, this.preferencesTab];
  }
}
