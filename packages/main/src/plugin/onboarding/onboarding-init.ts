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

import { ApiSenderType } from '/@api/api-sender/api-sender-type.js';
import { CONFIGURATION_DEFAULT_SCOPE } from '/@api/configuration/constants.js';
import { type IConfigurationNode, IConfigurationRegistry } from '/@api/configuration/models.js';
import type { IDisposable } from '/@api/disposable.js';
import { WelcomeSettings } from '/@api/welcome/welcome-settings.js';

import { CommandRegistry } from '../command-registry.js';
import { OnboardingRegistry } from '../onboarding-registry.js';
import { OnboardingSettings } from './onboarding-settings.js';

@injectable()
export class OnboardingInit implements IDisposable {
  #disposables: IDisposable[] = [];

  constructor(
    @inject(IConfigurationRegistry) private configurationRegistry: IConfigurationRegistry,
    @inject(CommandRegistry) private commandRegistry: CommandRegistry,
    @inject(OnboardingRegistry) private onboardingRegistry: OnboardingRegistry,
    @inject(ApiSenderType) private apiSender: ApiSenderType,
  ) {}

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
        [`${OnboardingSettings.SectionName}.${OnboardingSettings.OnboardAgain}`]: {
          description: 'Restart the onboarding process',
          markdownDescription:
            ':button[Onboard again]{command=onboarding.resetAndRestart title="Restart the onboarding process"}',
          type: 'markdown',
        },
      },
    };

    this.configurationRegistry.registerConfigurations([onboardingConfiguration]);

    this.#disposables.push(
      this.commandRegistry.registerCommand('onboarding.resetAndRestart', async () => {
        const onboardings = this.onboardingRegistry.listOnboarding();
        const extensions = onboardings.map(o => o.extension);
        if (extensions.length > 0) {
          this.onboardingRegistry.resetOnboarding(extensions);
        }
        await this.configurationRegistry.updateConfigurationValue(
          `${WelcomeSettings.SectionName}.${WelcomeSettings.Version}`,
          undefined,
          CONFIGURATION_DEFAULT_SCOPE,
        );
        this.apiSender.send('onboarding:restart');
      }),
    );
  }

  dispose(): void {
    this.#disposables.forEach(d => d.dispose());
  }
}
