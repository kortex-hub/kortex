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

@injectable()
export class ModelCatalogInit {
  constructor(@inject(IConfigurationRegistry) private configurationRegistry: IConfigurationRegistry) {}

  init(): void {
    const modelCatalogConfiguration: IConfigurationNode = {
      id: 'modelCatalog',
      title: 'Model Catalog',
      type: 'object',
      properties: {
        ['modelCatalog.disabledModels']: {
          description: 'Models disabled in the model catalog',
          type: 'array',
          default: [],
          hidden: true,
        },
      },
    };

    this.configurationRegistry.registerConfigurations([modelCatalogConfiguration]);
  }
}
