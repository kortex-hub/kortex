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

import { expect, type Locator, type Page } from '@playwright/test';

import { type FilesystemBadge, type NetworkAccessLevel, TIMEOUTS } from '/@/model/core/types';

import { BasePage } from './base-page';

export class AgentWorkspaceOverviewPage extends BasePage {
  readonly filesystemCard: Locator;
  readonly networkSection: Locator;

  constructor(page: Page) {
    super(page);
    // Use page-level locators: packaged Electron on macOS may not expose the Tab Content region.
    this.filesystemCard = this.page.locator('[aria-label="Filesystem card"]');
    this.networkSection = this.page.locator('[aria-label="Network"]').first();
  }

  async waitForLoad(): Promise<void> {
    await expect(this.page).toHaveURL(/\/overview(?:\?|$)/, { timeout: TIMEOUTS.STANDARD });
    await expect(this.filesystemCard).toBeVisible({ timeout: TIMEOUTS.STANDARD });
    await expect(this.networkSection).toBeVisible({ timeout: TIMEOUTS.STANDARD });
  }

  async expectFilesystemBadge(badge: FilesystemBadge): Promise<void> {
    await expect(this.filesystemCard.getByText(badge, { exact: true })).toBeVisible({
      timeout: TIMEOUTS.STANDARD,
    });
  }

  async expectNetworkLabel(label: NetworkAccessLevel): Promise<void> {
    await expect(this.networkSection.getByText(label, { exact: true })).toBeVisible({
      timeout: TIMEOUTS.STANDARD,
    });
  }

  async expectMountTargetVisible(target: string): Promise<void> {
    await expect(this.filesystemCard.getByText(target)).toBeVisible({ timeout: TIMEOUTS.STANDARD });
  }
}
