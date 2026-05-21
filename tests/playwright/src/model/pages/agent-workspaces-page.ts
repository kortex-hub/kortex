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
import { TIMEOUTS } from 'src/model/core/types';

import { AgentWorkspaceCreatePage } from './agent-workspace-create-page';
import { AgentWorkspaceDetailsPage } from './agent-workspace-details-page';
import { BaseTablePage } from './base-table-page';

export class AgentWorkspacesPage extends BaseTablePage {
  readonly header: Locator;
  readonly heading: Locator;
  readonly additionalActionsButtonGroup: Locator;
  readonly createButton: Locator;
  readonly noWorkspacesMessage: Locator;
  readonly filteredEmptyMessage: Locator;
  readonly clearFilterButton: Locator;
  readonly searchInput: Locator;

  constructor(page: Page) {
    super(page, 'agent-workspaces');
    this.header = this.page.getByRole('region', { name: 'header' });
    this.heading = this.header.getByRole('heading', { name: 'Agentic Workspaces' });
    this.additionalActionsButtonGroup = this.header.getByRole('group', { name: 'additionalActions' });
    this.createButton = this.additionalActionsButtonGroup.getByRole('button', { name: 'Create Workspace' });
    this.noWorkspacesMessage = this.content.getByRole('heading', { name: 'No agent workspaces' });
    this.filteredEmptyMessage = this.content.getByRole('heading', { name: /No sessions matching/ });
    this.clearFilterButton = this.content.getByRole('button', { name: 'Clear filter' });
    this.searchInput = this.page.getByLabel('search Agentic Workspaces');
  }

  async waitForLoad(): Promise<void> {
    await expect(this.heading).toBeVisible({ timeout: TIMEOUTS.SHORT });
  }

  private getStatCardValue(label: string): Locator {
    return this.content.getByText(label, { exact: true }).locator('..').locator('span').first();
  }

  async getStatCardCount(label: 'Active Sessions' | 'Total Sessions' | 'Configured Agents'): Promise<number> {
    const valueSpan = this.getStatCardValue(label);
    await expect(valueSpan).toBeVisible();
    const text = await valueSpan.textContent();
    return parseInt(text ?? '0', 10);
  }

  async getStatCounts(): Promise<{ activeSessions: number; totalSessions: number; configuredAgents: number }> {
    const [activeSessions, totalSessions, configuredAgents] = await Promise.all([
      this.getStatCardCount('Active Sessions'),
      this.getStatCardCount('Total Sessions'),
      this.getStatCardCount('Configured Agents'),
    ]);
    return { activeSessions, totalSessions, configuredAgents };
  }

  async openCreatePage(): Promise<AgentWorkspaceCreatePage> {
    await this.waitForLoad();
    await expect(this.createButton).toBeEnabled();
    await this.createButton.click();
    const createPage = new AgentWorkspaceCreatePage(this.page);
    await createPage.waitForLoad();
    return createPage;
  }

  async search(term: string): Promise<void> {
    await this.searchInput.fill(term);
  }

  getWorkspaceTerminalButton(name: string): Locator {
    return this.page.getByRole('button', { name: `Open terminal for workspace ${name}` });
  }

  async openWorkspaceDetails(name: string): Promise<AgentWorkspaceDetailsPage> {
    const row = await this.getRowLocatorByName(name);
    await row.getByText(name).click();
    const detailsPage = new AgentWorkspaceDetailsPage(this.page);
    await detailsPage.waitForLoad();
    return detailsPage;
  }

  async openWorkspaceTerminal(name: string): Promise<AgentWorkspaceDetailsPage> {
    const terminalButton = this.getWorkspaceTerminalButton(name);
    await expect(terminalButton).toBeVisible();
    await terminalButton.click();
    const detailsPage = new AgentWorkspaceDetailsPage(this.page);
    await detailsPage.waitForLoad();
    return detailsPage;
  }

  async removeWorkspace(name: string): Promise<void> {
    const row = await this.getRowLocatorByName(name);
    const removeButton = row.getByRole('button', { name: 'Remove workspace' });
    await expect(removeButton).toBeVisible();
    await removeButton.click();
    const confirmButton = this.page.getByRole('button', { name: 'Yes' });
    await expect(confirmButton).toBeVisible({ timeout: TIMEOUTS.SHORT });
    await confirmButton.click();
  }

  async waitForWorkspaceStatus(
    name: string,
    status: string,
    timeout: number = TIMEOUTS.WORKSPACE_READY,
  ): Promise<void> {
    const displayStatus = status.charAt(0).toUpperCase() + status.slice(1);
    const row = this.table.getByRole('row').filter({ hasText: name });
    await expect
      .poll(
        async () => {
          const statusText = await row.getByText(displayStatus, { exact: true }).count();
          return statusText > 0;
        },
        { timeout, message: `Workspace "${name}" did not reach "${status}" status within ${timeout}ms` },
      )
      .toBeTruthy();
  }
}
