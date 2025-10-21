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

import { BasePage } from './base-page';

export const builtInExtensions = [
  { name: 'Default MCP Registries', locator: 'kortex.mcp-registries' },
  { name: 'Gemini', locator: 'kortex.gemini' },
  { name: 'goose', locator: 'kortex.goose' },
  { name: 'OpenAI Compatible', locator: 'kortex.openai-compatible' },
  { name: 'OpenShift AI', locator: 'kortex.openshift-ai' },
] as const;

export type ExtensionLocator = (typeof builtInExtensions)[number]['locator'];

export enum Button {
  STOP = 'Stop',
  START = 'Start',
  DELETE = 'Delete',
}

export enum State {
  ACTIVE = 'ACTIVE',
  DISABLED = 'DISABLED',
}

export const BADGE_TEXT = 'built-in Extension' as const;

export enum BadgeType {
  BUILT_IN = 'badge-built-in Extension',
}

export enum ExtensionStatus {
  RUNNING = 'running',
  STOPPED = 'stopped',
  UNKNOWN = 'unknown',
}

export class ExtensionsInstalledPage extends BasePage {
  constructor(page: Page) {
    super(page);
  }

  async waitForLoad(): Promise<void> {
    await expect(this.getExtension(builtInExtensions[0].locator)).toBeVisible();
  }

  getExtension(locator: ExtensionLocator): Locator {
    return this.page.getByLabel(locator);
  }

  getExtensionButton(locator: ExtensionLocator, buttonType: Button): Locator {
    const extensionElement = this.getExtension(locator);
    return extensionElement.getByLabel(buttonType);
  }

  getExtensionBadge(locator: ExtensionLocator): Locator {
    const extensionElement = this.getExtension(locator);
    return extensionElement.getByLabel(BadgeType.BUILT_IN);
  }

  async clickExtensionButton(locator: ExtensionLocator, buttonType: Button): Promise<void> {
    await this.getExtensionButton(locator, buttonType).click();
  }

  extensionState(locator: ExtensionLocator): Locator {
    const extensionElement = this.getExtension(locator);
    return extensionElement.getByLabel('Extension Status Label');
  }

  async getExtensionState(locator: ExtensionLocator): Promise<ExtensionStatus> {
    try {
      const statusLabel = this.extensionState(locator);
      const status = await statusLabel.textContent();

      if (status === State.ACTIVE) {
        return ExtensionStatus.RUNNING;
      } else if (status === State.DISABLED) {
        return ExtensionStatus.STOPPED;
      } else {
        return ExtensionStatus.UNKNOWN;
      }
    } catch {
      return ExtensionStatus.UNKNOWN;
    }
  }

  async stopExtensionAndVerify(locator: ExtensionLocator): Promise<void> {
    await this.clickExtensionButton(locator, Button.STOP);
    await expect(this.extensionState(locator)).toHaveText(State.DISABLED, {
      timeout: 5_000,
    });
  }

  async startExtensionAndVerify(locator: ExtensionLocator): Promise<void> {
    await this.clickExtensionButton(locator, Button.START);
    await expect(this.extensionState(locator)).toHaveText(State.ACTIVE, {
      timeout: 5_000,
    });
  }
}
