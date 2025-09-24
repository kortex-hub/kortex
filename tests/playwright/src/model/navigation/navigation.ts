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

import { type Locator, type Page } from '@playwright/test';

export class NavigationBar {
  readonly page: Page;
  readonly navigationLocator: Locator;
  readonly chatLink: Locator;
  readonly mcpLink: Locator;
  readonly flowsLink: Locator;
  readonly extensionsLink: Locator;
  readonly settingsLink: Locator;

  constructor(page: Page) {
    this.page = page;
    this.navigationLocator = this.page.getByRole('navigation', {
      name: 'AppNavigation',
    });
    this.chatLink = this.navigationLocator.getByRole('link', { name: 'Chat' });
    this.mcpLink = this.navigationLocator.getByRole('link', { name: 'MCP' });
    this.flowsLink = this.navigationLocator.getByRole('link', { name: 'Flows', exact: true });
    this.settingsLink = this.navigationLocator.getByRole('link', { name: 'Settings', exact: true });
    this.extensionsLink = this.navigationLocator.getByRole('link', {
      name: 'Extensions',
      exact: true,
    });
  }
}
