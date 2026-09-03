/**********************************************************************
 * Copyright (C) 2024-2025 Red Hat, Inc.
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
import type { ExtensionBanner, RecommendedRegistry } from '/@api/recommendations/recommendations.js';
import { RecommendationsSettings } from '/@api/recommendations/recommendations-settings.js';

@injectable()
export class RecommendationsRegistry {
  constructor(
    @inject(IConfigurationRegistry)
    private configurationRegistry: IConfigurationRegistry,
  ) {}

  isBannerRecommendationEnabled(): boolean {
    const bannersIgnored = !this.configurationRegistry
      .getConfiguration(RecommendationsSettings.SectionName)
      .get<boolean>(RecommendationsSettings.IgnoreBannerRecommendations, false);
    const recommendationsIgnored = this.isRecommendationEnabled();
    return bannersIgnored && recommendationsIgnored;
  }

  isRecommendationEnabled(): boolean {
    return !this.configurationRegistry
      .getConfiguration(RecommendationsSettings.SectionName)
      .get<boolean>(RecommendationsSettings.IgnoreRecommendations, false);
  }

  async getRegistries(): Promise<RecommendedRegistry[]> {
    return [];
  }

  /**
   * Return the recommended extension banners which are not installed.
   * @param limit the maximum number of extension banners returned. Default 1, use -1 for no limit
   */
  async getExtensionBanners(_limit = 5): Promise<ExtensionBanner[]> {
    return [];
  }

  init(): void {
    const recommendationConfiguration: IConfigurationNode = {
      id: 'preferences.extensions',
      title: 'Extensions',
      type: 'object',
      properties: {
        [`${RecommendationsSettings.SectionName}.${RecommendationsSettings.IgnoreRecommendations}`]: {
          description: 'When enabled, the notifications for extension recommendations will not be shown.',
          type: 'boolean',
          default: false,
          hidden: false,
        },
        [`${RecommendationsSettings.SectionName}.${RecommendationsSettings.IgnoreBannerRecommendations}`]: {
          description: 'When enabled, the notifications for extension recommendations banners will not be shown.',
          type: 'boolean',
          default: false,
          hidden: false,
        },
      },
    };

    this.configurationRegistry.registerConfigurations([recommendationConfiguration]);
  }
}
