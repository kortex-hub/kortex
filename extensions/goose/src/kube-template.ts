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
import mustache from 'mustache';

import template from './templates/kube.mustache?raw';

export interface KubeTemplateOptions {
  job: {
    name: string;
  };
  kortex: {
    version: string;
  };
  recipe: {
    flowId: string;
    name: string;
    content: string;
    params: Array<{ key: string; value: string }>;
  };
  provider: {
    name: string;
    credentials: {
      env: Array<{ key: string; value: string }>;
    };
  };
  namespace: string;
}

// https://github.com/packit/ai-workflows/tree/main/goose-container
export const GOOSE_IMAGE = 'quay.io/kortex/goose:2025-09-03'; //'quay.io/jotnar/goose:latest';

export const KORTEX_VERSION_ANNOTATION = 'kortex-hub/version';
export const KORTEX_FLOW_ID_ANNOTATION = 'kortex-hub/flow-id';

export class KubeTemplate {
  constructor(private readonly options: KubeTemplateOptions) {}

  protected format(): unknown {
    return {
      ...this.options,
      recipe: {
        ...this.options.recipe,
        content: this.options.recipe.content.split('\n'),
      },
      // annotations KEYS
      annotations: {
        version: KORTEX_VERSION_ANNOTATION,
        flowId: KORTEX_FLOW_ID_ANNOTATION,
      },
      container: GOOSE_IMAGE,
    };
  }

  render(): string {
    return mustache.render(template, this.format());
  }
}
