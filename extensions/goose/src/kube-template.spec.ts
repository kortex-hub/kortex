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

import { join } from 'node:path';

import { expect, test } from 'vitest';

import type { KubeTemplateOptions } from './kube-template';
import { KubeTemplate } from './kube-template';

test.each<KubeTemplateOptions & { testName: string }>([
  {
    testName: 'gemini',
    job: { name: 'job-1' },
    namespace: 'ns1',
    recipe: {
      flowId: 'demo-flow-id',
      name: 'echo',
      content: `title: "Paris Explorer"
name: "Paris Explorer"
description: "Paris Explorer"

# Required for headless mode
prompt: "Plan a 7 days trip in Paris, mention per day the planning, starting on monday."

instructions: |
  Your task is to:
  1. List the important monuments
  2. Plan each day of the trip
      `,
    },
    provider: {
      name: 'google',
      credentials: {
        env: [{ key: 'GOOGLE_API_KEY', value: 'dummy' }],
      },
    },
    kortex: {
      version: '1.0.0',
    },
  },
])('$testName', async options => {
  const template = new KubeTemplate(options);
  await expect(template.render()).toMatchFileSnapshot(join('test-snapshots', `${options.testName}.yaml`));
});
