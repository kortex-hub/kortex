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

import type { ModelInfo } from '/@/api/model-info';
import type { RamalamaContainerInfo } from '/@/api/ramalama-container-info';

export class ContainerModelExtractor {
  async extractModelInfo(container: RamalamaContainerInfo): Promise<ModelInfo> {
    const modelName = container.Labels['ai.ramalama.model'];
    const portLabel = container.Labels['ai.ramalama.port'];
    const port = portLabel ? Number.parseInt(portLabel, 10) : 0;

    return {
      name: modelName,
      port: port,
    };
  }
}
