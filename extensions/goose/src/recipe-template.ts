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

import template from './templates/recipe.mustache?raw';

interface RecipeTemplateOptions {
  recipe: {
    title: string;
    name: string;
    prompt: string;
    instructions: string;
  }
}

export class RecipeTemplate {
  constructor(private readonly options: RecipeTemplateOptions) {}

  protected format(): unknown {
    return {
      ...this.options,
      recipe: {
        ...this.options.recipe,
        // hacky way of keeping indentation in mustache
        instructions: this.options.recipe.instructions.split('\n'),
      },
    };
  }

  render(): string {
    return mustache.render(template, this.format());
  }
}
