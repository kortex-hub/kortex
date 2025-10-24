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

import { BasePage } from './base-page';

export abstract class McpBaseTabPage extends BasePage {
  readonly content: Locator;
  readonly table: Locator;

  constructor(page: Page, tableName: string) {
    super(page);
    this.content = page.getByRole('region', { name: 'content' });
    this.table = this.content.getByRole('table', { name: tableName });
  }

  async getTableRow(name: string): Promise<Locator | undefined> {
    const locator = this.table.getByRole('row', { name: name, exact: true });
    return (await locator.count()) > 0 ? locator : undefined;
  }

  async countRowsFromTable(): Promise<number> {
    const rows = await this.table.getByRole('row').all();
    return rows.length - 1;
  }
}
