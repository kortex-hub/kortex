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
import { expect, test } from 'vitest';

import { formatInputWithVariables } from './input-with-variables.js';

interface FormatInputWithVariablesTestCase {
  name: string;
  input: components['schemas']['InputWithVariables'];
  expected: string;
}

test.each<FormatInputWithVariablesTestCase>([
  {
    name: 'input with no variable',
    input: {
      value: '--foo',
      isRequired: true,
      format: 'string',
      isSecret: false,
    },
    expected: '--foo',
  },
  {
    name: 'input with one variable containing default',
    input: {
      value: '--foo={bar}',
      isRequired: true,
      format: 'string',
      isSecret: false,
      variables: {
        bar: {
          isSecret: false,
          default: 'bar',
          format: 'string',
          isRequired: true,
        },
      },
    },
    expected: '--foo=bar',
  },
  {
    name: 'input with one variable containing value and default',
    input: {
      value: '--foo={bar}',
      isRequired: true,
      format: 'string',
      isSecret: false,
      variables: {
        bar: {
          isSecret: false,
          default: 'bar',
          format: 'string',
          isRequired: true,
          value: 'potatoes',
        },
      },
    },
    expected: '--foo=potatoes',
  },
  {
    name: 'input with two variables',
    input: {
      value: '--foo={foo},--bar={bar}',
      isRequired: true,
      format: 'string',
      isSecret: false,
      variables: {
        foo: {
          isSecret: false,
          default: 'foo',
          format: 'string',
          isRequired: true,
        },
        bar: {
          isSecret: false,
          default: 'bar',
          format: 'string',
          isRequired: true,
        },
      },
    },
    expected: '--foo=foo,--bar=bar',
  },
])('$name', ({ input, expected }) => {
  const formatted = formatInputWithVariables(input);
  expect(formatted).toEqual(expected);
});
