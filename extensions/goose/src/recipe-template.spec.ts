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

import type { RecipeTemplateOptions } from './recipe-template';
import { RecipeTemplate } from './recipe-template';

test.each<RecipeTemplateOptions & { testName: string }>([
  {
    testName: 'simple-recipe',
    recipe: {
      name: 'echo',
      prompt: 'echo the user prompt',
      description: '',
      title: 'Echo',
      instructions: 'echo the user prompt',
      extensions: [],
      settings: {
        goose_provider: '',
        goose_model: '',
      },
    },
  },
  {
    testName: 'recipe-with-extensions',
    recipe: {
      name: 'paris-trip',
      prompt: 'make a trip to paris',
      description: '',
      title: 'Echo',
      instructions: 'echo the user prompt',
      extensions: [
        {
          name: 'github-mcp',
          type: 'http',
          uri: 'https://api.githubcopilot.com/mcp/',
          headers: [
            {
              key: 'Authorization',
              value: 'Dummy',
            },
          ],
        },
      ],
      settings: {
        goose_provider: '',
        goose_model: '',
      },
    },
  },
])('$testName', async options => {
  const template = new RecipeTemplate(options);
  await expect(template.render()).toMatchFileSnapshot(join('test-snapshots', `${options.testName}.yaml`));
});
