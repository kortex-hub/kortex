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

import { expect } from '@playwright/test';

import type { CodingAgent, WorkspaceInferenceProviderId } from '/@/model/core/types';
import type { NavigationBar } from '/@/model/navigation/navigation';
import type { GuidedSetupPage } from '/@/model/pages/guided-setup-page';

export async function restartOnboarding(navigationBar: NavigationBar, guidedSetup: GuidedSetupPage): Promise<void> {
  const settingsPage = await navigationBar.navigateToSettingsPage();
  const preferencesPage = await settingsPage.openPreferences();
  await preferencesPage.clickOnboardAgain();
  await expect(guidedSetup.welcomePage).toBeVisible();
}

export async function expectDefaultModelInCodingAgents(
  navigationBar: NavigationBar,
  agent: CodingAgent,
  modelLabel: string,
): Promise<void> {
  const codingAgentsPage = await navigationBar.navigateToCodingAgentsPage();
  await codingAgentsPage.selectAgent(agent);
  await codingAgentsPage.expectDefaultModelSelected(modelLabel);
}

export interface GuidedSetupCompletion {
  modelLabel: string;
  availableModelCount: number;
}

export async function completeGuidedSetupWithModel(
  guidedSetup: GuidedSetupPage,
  agent: CodingAgent,
  pickLabel: (labels: string[]) => string,
  preferredProviderId?: WorkspaceInferenceProviderId,
): Promise<GuidedSetupCompletion> {
  await guidedSetup.startFromWelcome();
  await guidedSetup.ensureModelCatalogFor(agent, preferredProviderId);
  const modelLabels = await guidedSetup.getModelLabels();
  const modelLabel = pickLabel(modelLabels);
  await guidedSetup.selectModelByLabel(modelLabel);
  await guidedSetup.complete();
  return { modelLabel, availableModelCount: modelLabels.length };
}
