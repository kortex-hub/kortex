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

import type { IconDefinition } from '@fortawesome/fontawesome-common-types';
import { faCube, faRobot } from '@fortawesome/free-solid-svg-icons';
import type { Component } from 'svelte';

import type { DefaultWorkspaceModelSettings, DefaultWorkspaceSettings } from '/@api/onboarding-settings-info';

import CodingAgentStep from './CodingAgentStep.svelte';
import ModelStep from './ModelStep.svelte';

export type CliAgent = 'opencode' | 'claude' | 'claude-vertex' | 'cursor' | 'goose';

// TODO: Remove VertexConfig once the Vertex AI extension is added and handles its own config.
export interface VertexConfig {
  projectId: string;
  region: string;
  credentialsPath: string;
  mountClaudeConfig?: boolean;
}

export interface OnboardingState {
  agent: CliAgent;
  secretName?: string;
  model?: DefaultWorkspaceModelSettings;
  vertexConfig?: VertexConfig;
  workspaceSetting: DefaultWorkspaceSettings;
  beforeAdvance?: () => Promise<boolean>;
}

export interface GuidedSetupStepProps {
  stepId: string;
  title: string;
  description: string;
  onboarding: OnboardingState;
}

export interface GuidedSetupStep {
  id: string;
  title: string;
  description: string;
  icon: IconDefinition;
  component: Component<GuidedSetupStepProps>;
  isComplete: () => boolean;
  isSkippable: boolean;
}

export function createDefaultOnboardingState(): OnboardingState {
  return {
    agent: 'opencode',
    workspaceSetting: {},
  };
}

export const guidedSetupSteps: GuidedSetupStep[] = [
  {
    id: 'coding-agent',
    title: 'Coding agent',
    description:
      'Pick the default coding agent runtime. The API notes below update for your choice. You can change this later in settings.',
    icon: faRobot,
    component: CodingAgentStep,
    isComplete: (): boolean => false,
    isSkippable: true,
  },
  {
    id: 'model-selection',
    title: 'Model',
    description: 'Select the default model for your coding agent.',
    icon: faCube,
    component: ModelStep,
    isComplete: (): boolean => false,
    isSkippable: true,
  },
];
