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

import { formatInputWithVariables } from './input-with-variables.js';

export function formatKeyValueInputs(
  items: Array<components['schemas']['KeyValueInput']> | undefined,
  values: Record<string, string>,
): Record<string, string> {
  if (!items) return {};

  return items.reduce(
    (accumulator, current) => {
      const value = values[current.name];
      if (value) {
        accumulator[current.name] = value;
      } else {
        const formatted = formatInputWithVariables(current);
        if (formatted) {
          accumulator[current.name] = formatted;
        } else if (current.isRequired) {
          throw new Error(`value for ${current.name} is missing`);
        }
      }
      return accumulator;
    },
    {} as Record<string, string>,
  );
}
