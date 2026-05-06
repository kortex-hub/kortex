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

import { inject, injectable } from 'inversify';

import { type IConfigurationNode, IConfigurationRegistry } from '/@api/configuration/models.js';

import { OnboardingSettings } from './onboarding-settings.js';

@injectable()
export class OnboardingInit {
  constructor(@inject(IConfigurationRegistry) private configurationRegistry: IConfigurationRegistry) {}

  init(): void {
    const onboardingConfiguration: IConfigurationNode = {
      id: 'preferences.onboarding',
      title: 'Onboarding',
      type: 'object',
      properties: {
        [`${OnboardingSettings.SectionName}.${OnboardingSettings.DefaultWorkspaceSettings}`]: {
          description: 'Default workspace settings selected during onboarding',
          type: 'object',
          default: {},
          hidden: true,
        },
        [`${OnboardingSettings.SectionName}.${OnboardingSettings.VertexProjectId}`]: {
          description: 'Google Cloud project ID for Claude on Vertex AI',
          type: 'string',
          default: '',
          hidden: true,
        },
        [`${OnboardingSettings.SectionName}.${OnboardingSettings.VertexRegion}`]: {
          description: 'Google Cloud region for Claude on Vertex AI',
          type: 'string',
          default: '',
          hidden: true,
        },
        [`${OnboardingSettings.SectionName}.${OnboardingSettings.VertexCredentialsPath}`]: {
          description: 'Path to Google Cloud credentials directory for Claude on Vertex AI',
          type: 'string',
          default: '',
          hidden: true,
        },
      },
    };

    this.configurationRegistry.registerConfigurations([onboardingConfiguration]);
  }
}
