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

import { BasePage } from './base-page';

export enum PreferenceOption {
  APPEARANCE = 'Appearance',
  EDITOR = 'Editor',
  EXIT_ON_CLOSE = 'Exit On Close',
  EXPERIMENTAL_STATUS_BAR = 'Experimental (Status Bar Providers)',
  EXTENSIONS = 'Extensions',
  KUBERNETES = 'Kubernetes',
  TASKS = 'Tasks',
  TELEMETRY = 'Telemetry',
  TERMINAL = 'Terminal',
  USER_CONFIRMATION = 'User Confirmation',
  WINDOW = 'Window',
}

export const preferenceOptions = (): PreferenceOption[] => Object.values(PreferenceOption);

export class SettingsPreferencesPage extends BasePage {
  readonly searchField: Locator;

  constructor(page: Page) {
    super(page);
    this.searchField = page.getByLabel('search preferences');
  }

  async waitForLoad(): Promise<void> {
    await expect(this.searchField).toBeVisible();
  }

  async searchPreferences(searchTerm: string): Promise<void> {
    await this.searchField.fill(searchTerm);
  }

  async clearSearch(): Promise<void> {
    await this.searchField.clear();
  }

  getPreferenceLink(option: PreferenceOption): Locator {
    const preferencesNav = this.page.getByRole('navigation', { name: 'PreferencesNavigation' });
    return preferencesNav.getByRole('link', { name: option });
  }

  getPreferenceContent(option: PreferenceOption): Locator {
    return this.page.getByText(option, { exact: true }).first();
  }

  async selectPreference(option: PreferenceOption): Promise<void> {
    const preferenceLink = this.getPreferenceLink(option);
    await expect(preferenceLink).toBeVisible();
    await preferenceLink.click();
    await expect(this.getPreferenceContent(option)).toBeVisible();
  }
}
