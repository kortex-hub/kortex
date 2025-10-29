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
import { expect } from '@playwright/test';
import type { ExtensionLocator } from 'src/model/core/types';
import { BadgeType, builtInExtensions, Button, ExtensionStatus, State } from 'src/model/core/types';

import { BasePage } from './base-page';

export class ExtensionsInstalledPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async waitForLoad(): Promise<void> {
    await expect(this.getExtension(builtInExtensions[0].locator)).toBeVisible();
  }

  public getExtension(locator: ExtensionLocator): Locator {
    return this.page.getByLabel(locator);
  }

  public getExtensionBadge(locator: ExtensionLocator): Locator {
    const extensionElement = this.getExtension(locator);
    return extensionElement.getByLabel(BadgeType.BUILT_IN);
  }

  public async getExtensionState(locator: ExtensionLocator): Promise<ExtensionStatus> {
    try {
      const statusLabel = this.extensionStateLocator(locator);
      const status = (await statusLabel.textContent()) ?? '';

      switch (status) {
        case State.ACTIVE:
          return ExtensionStatus.RUNNING;

        case State.DISABLED:
          return ExtensionStatus.STOPPED;

        default:
          return ExtensionStatus.UNKNOWN;
      }
    } catch {
      return ExtensionStatus.UNKNOWN;
    }
  }

  public async stopExtensionAndVerify(locator: ExtensionLocator, timeout = 10_000): Promise<void> {
    await this.clickExtensionButton(locator, Button.STOP);
    await expect(this.extensionStateLocator(locator)).toHaveText(State.DISABLED, {
      timeout,
    });
  }

  public async startExtensionAndVerify(locator: ExtensionLocator, timeout = 10_000): Promise<void> {
    await this.clickExtensionButton(locator, Button.START);
    await expect(this.extensionStateLocator(locator)).toHaveText(State.ACTIVE, {
      timeout,
    });
  }

  public async toggleExtensionState(locator: ExtensionLocator): Promise<void> {
    const currentState = await this.getExtensionState(locator);
    switch (currentState) {
      case ExtensionStatus.RUNNING:
        await this.stopExtensionAndVerify(locator);
        break;
      case ExtensionStatus.STOPPED:
        await this.startExtensionAndVerify(locator);
        break;
      default:
        throw new Error(`Cannot toggle extension with unknown state: ${locator}`);
    }
  }

  public getDeleteButtonForExtension(locator: ExtensionLocator): Locator {
    return this.getExtensionButton(locator, Button.DELETE);
  }

  public getStartButtonForExtension(locator: ExtensionLocator): Locator {
    return this.getExtensionButton(locator, Button.START);
  }

  public getStopButtonForExtension(locator: ExtensionLocator): Locator {
    return this.getExtensionButton(locator, Button.STOP);
  }

  private extensionStateLocator(locator: ExtensionLocator): Locator {
    const extensionElement = this.getExtension(locator);
    return extensionElement.getByLabel('Extension Status Label');
  }

  private async clickExtensionButton(locator: ExtensionLocator, buttonType: Button): Promise<void> {
    const button = this.getExtensionButton(locator, buttonType);
    await expect(button).toBeEnabled();
    await button.click();
  }

  private getExtensionButton(locator: ExtensionLocator, buttonType: Button): Locator {
    const extensionElement = this.getExtension(locator);
    return extensionElement.getByLabel(buttonType);
  }
}
