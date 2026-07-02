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

import { mkdtempSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import type { Expect } from '@playwright/test';

import type { test as providerTest } from '/@/fixtures/provider-fixtures';
import {
  type CodingAgent,
  PROVIDERS,
  type ResourceId,
  TIMEOUTS,
  WIZARD_STEP,
  WORKSPACE_STATUS,
} from '/@/model/core/types';
import type { AgentWorkspaceCreatePage } from '/@/model/pages/agent-workspace-create-page';
import { waitForNavigationReady } from '/@/utils/app-ready';

export interface WorkspaceLifecycleConfig {
  testIdPrefix: string;
  workspaceName: string;
  agent: CodingAgent;
  requiredResource?: ResourceId;
  selectModel: (createPage: AgentWorkspaceCreatePage) => Promise<string | undefined>;
  terminalReadyPatterns: RegExp[];
  prePrompts?: { command: string; expectedResponse: RegExp }[];
  promptTimeout?: number;
  promptTest: {
    prompt: string;
    expectedResponse: RegExp;
  };
}

export function registerWorkspaceLifecycleTests(
  test: typeof providerTest,
  expect: Expect,
  config: WorkspaceLifecycleConfig,
): void {
  const podmanAvailable = !!process.env.PODMAN_ENABLED;

  test.skip(
    process.platform !== 'linux' && !podmanAvailable,
    'Workspace tests require Podman (set PODMAN_ENABLED=true on non-Linux)',
  );

  if (config.requiredResource) {
    const envVar = PROVIDERS[config.requiredResource].envVarName;
    test.skip(!process.env[envVar], `${envVar} not set`);
  }

  let workingDir: string | undefined;
  let countsBefore: { activeSessions: number; totalSessions: number; configuredAgents: number };

  test.beforeAll(async ({ workerNavigationBar }) => {
    await workerNavigationBar.ensureExtensionsRunning();

    if (config.requiredResource) {
      const provider = PROVIDERS[config.requiredResource];
      if (!('autoDetected' in provider && provider.autoDetected)) {
        const settingsPage = await workerNavigationBar.navigateToSettingsPage();
        await settingsPage.createResource(config.requiredResource, process.env[provider.envVarName]!);
        // Warm navigation so inference providers finish registering models before the wizard opens.
        await workerNavigationBar.navigateToWorkspacesPage();
      }
    }
    workingDir = mkdtempSync(join(homedir(), '.kdn-e2e-'));
  });

  test.afterAll(async ({ workerNavigationBar }) => {
    if (workingDir) {
      rmSync(workingDir, { recursive: true, force: true });
    }
    if (config.requiredResource) {
      const provider = PROVIDERS[config.requiredResource];
      if (!('autoDetected' in provider && provider.autoDetected)) {
        try {
          const settingsPage = await workerNavigationBar.navigateToSettingsPage();
          await settingsPage.deleteResource(config.requiredResource);
        } catch (error) {
          console.error(`Failed to delete ${config.requiredResource} resource:`, error);
        }
      }
    }
  });

  test.beforeEach(async ({ page }) => {
    await waitForNavigationReady(page);
  });

  test(`[${config.testIdPrefix}-01] Creates a workspace`, async ({ navigationBar, agentWorkspacesPage }) => {
    await navigationBar.navigateToWorkspacesPage();
    countsBefore = await agentWorkspacesPage.getStatCounts();
    const createPage = await agentWorkspacesPage.openCreatePage();

    await createPage.sessionNameInput.fill(config.workspaceName);
    await createPage.workingDirInput.fill(workingDir!);
    await createPage.continueToStep(WIZARD_STEP.AGENT_MODEL);

    await createPage.selectAgent(config.agent);
    await createPage.waitForModelCatalog();
    await config.selectModel(createPage);

    await createPage.continueToStep(WIZARD_STEP.TOOLS_SECRETS);
    await createPage.continueToStep(WIZARD_STEP.FILE_SYSTEM);
    await createPage.continueToStep(WIZARD_STEP.NETWORKING);

    await createPage.startWorkspace();
    await expect(agentWorkspacesPage.heading).toBeVisible({ timeout: TIMEOUTS.WORKSPACE_READY });
  });

  test(`[${config.testIdPrefix}-02] Workspace appears with Running status`, async ({
    navigationBar,
    agentWorkspacesPage,
  }) => {
    await navigationBar.navigateToWorkspacesPage();
    await agentWorkspacesPage.ensureRowExists(config.workspaceName, TIMEOUTS.WORKSPACE_READY);
    await agentWorkspacesPage.waitForWorkspaceStatus(
      config.workspaceName,
      WORKSPACE_STATUS.RUNNING,
      TIMEOUTS.WORKSPACE_READY,
    );
  });

  test(`[${config.testIdPrefix}-03] Stat cards reflect the new workspace`, async ({
    navigationBar,
    agentWorkspacesPage,
  }) => {
    await navigationBar.navigateToWorkspacesPage();
    const countsAfter = await agentWorkspacesPage.getStatCounts();
    expect(countsAfter.totalSessions).toBe(countsBefore.totalSessions + 1);
    expect(countsAfter.activeSessions).toBe(countsBefore.activeSessions + 1);
    expect(countsAfter.configuredAgents).toBeGreaterThanOrEqual(countsBefore.configuredAgents);
  });

  test(`[${config.testIdPrefix}-04] Terminal shows agent is loaded`, async ({ navigationBar, agentWorkspacesPage }) => {
    await navigationBar.navigateToWorkspacesPage();
    const detailsPage = await agentWorkspacesPage.openWorkspaceTerminal(config.workspaceName);
    const terminalPage = detailsPage.getTerminalPage();
    for (const pattern of config.terminalReadyPatterns) {
      await terminalPage.waitForTerminalContent(pattern, TIMEOUTS.STANDARD);
    }
  });

  test(`[${config.testIdPrefix}-05] Sends a prompt and receives a response`, async ({
    navigationBar,
    agentWorkspacesPage,
  }) => {
    const promptTimeout = config.promptTimeout ?? TIMEOUTS.STANDARD;
    await navigationBar.navigateToWorkspacesPage();
    const detailsPage = await agentWorkspacesPage.openWorkspaceTerminal(config.workspaceName);
    const terminalPage = detailsPage.getTerminalPage();

    await terminalPage.waitForTerminalContent(config.terminalReadyPatterns[0]!, TIMEOUTS.STANDARD);

    if (config.prePrompts) {
      for (const pre of config.prePrompts) {
        await terminalPage.sendPrompt({
          prompt: pre.command,
          expectedResponse: pre.expectedResponse,
          timeout: TIMEOUTS.STANDARD,
        });
      }
    }

    await terminalPage.sendPrompt({
      prompt: config.promptTest.prompt,
      expectedResponse: config.promptTest.expectedResponse,
      timeout: promptTimeout,
    });
  });

  test(`[${config.testIdPrefix}-06] Removes the workspace`, async ({ navigationBar, agentWorkspacesPage }) => {
    await navigationBar.navigateToWorkspacesPage();
    await agentWorkspacesPage.removeWorkspace(config.workspaceName);
    await expect(agentWorkspacesPage.noWorkspacesMessage.or(agentWorkspacesPage.table)).toBeVisible();
    if (await agentWorkspacesPage.table.isVisible()) {
      await agentWorkspacesPage.ensureRowDoesNotExist(config.workspaceName, TIMEOUTS.WORKSPACE_READY);
    }
  });

  test(`[${config.testIdPrefix}-07] Stat cards reflect workspace removal`, async ({
    navigationBar,
    agentWorkspacesPage,
  }) => {
    await navigationBar.navigateToWorkspacesPage();
    const countsAfterRemoval = await agentWorkspacesPage.getStatCounts();
    expect(countsAfterRemoval.totalSessions).toBe(countsBefore.totalSessions);
    expect(countsAfterRemoval.activeSessions).toBe(countsBefore.activeSessions);
  });
}
