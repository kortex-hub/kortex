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
import type { components } from '@kortex-hub/mcp-registry-types';

export function formatInputWithVariables(input: components['schemas']['InputWithVariables']): string | undefined {
  let template = input.value ?? input.default;
  if (!template) {
    return undefined;
  }

  for (const [key, content] of Object.entries(input.variables ?? {})) {
    const value = content.value ?? content.default;
    if (content.isRequired && !value)
      throw new Error(`cannot format input with required variable ${key} without any value or default`);

    if (value !== undefined) {
      template = template.replace(`{${key}}`, value);
    }
  }
  return template;
}
