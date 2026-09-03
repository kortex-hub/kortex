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

import { type Page, test } from '@playwright/test';

import type { CodingAgent } from '/@/model/core/types';
import { WIZARD_STEP } from '/@/model/core/types';
import { NavigationBar } from '/@/model/navigation/navigation';
import { agentModelSetupSkipMessageFor, isAgentModelSetupAvailable } from '/@/model/pages/agent-model-setup';
import { AgentWorkspacesPage } from '/@/model/pages/agent-workspaces-page';
import type { GuidedSetupPage } from '/@/model/pages/guided-setup-page';

/** Uses the describe title itself to surface the skip reason, so it's visible in the test report. */
export function describeIfAvailable(available: boolean, title: string, skipReason: string, body: () => void): void {
  const describeFn = available ? test.describe : test.describe.skip;
  describeFn(available ? title : skipReason, body);
}

export function describeAgentOnboarding(agent: CodingAgent, title: string, body: () => void): void {
  describeIfAvailable(isAgentModelSetupAvailable(agent), title, agentModelSetupSkipMessageFor(agent), body);
}

export async function completeGuidedSetupFor(guidedSetup: GuidedSetupPage, agent: CodingAgent): Promise<string> {
  await guidedSetup.startFromWelcome();
  const selectedModel = await guidedSetup.completeAgentModelFor(agent);
  await guidedSetup.complete();
  return selectedModel;
}

export async function expectDefaultsInWorkspaceWizard(
  page: Page,
  agent: CodingAgent,
  modelLabel: string,
): Promise<void> {
  const navigationBar = new NavigationBar(page);
  const agentWorkspacesPage = new AgentWorkspacesPage(page);
  await navigationBar.navigateToWorkspacesPage();
  const createPage = await agentWorkspacesPage.openCreatePage();
  await createPage.sessionNameInput.fill('guided-setup-test');
  await createPage.navigateToStep(WIZARD_STEP.AGENT_MODEL);
  await createPage.expectAgentSelected(agent);
  await createPage.expectModelSelected(modelLabel);
}
