/**********************************************************************
 * Copyright (C) 202 Red Hat, Inc.
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

import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/svelte';
import { expect, test } from 'vitest';

import type { FlowInfo } from '/@api/flow-info';

import FlowName from './FlowName.svelte';

test.each([
  ['/some/path/filename1.yaml', 'filename1'],
  ['/some/path/filename2', 'filename2'],
  ['\\some\\path\\filename3.yaml', 'filename3'],
  ['/filename4', 'filename4'],
])('Get from %s path filename %s', (path: string, fileName: string) => {
  const flowInfo: FlowInfo = {
    providerId: 'provider1',
    connectionName: 'connecction1',
    id: 'flow1',
    path: path,
  };
  render(FlowName, { object: flowInfo });

  expect(screen.getByText(fileName)).toBeInTheDocument();
  expect(screen.getByText(path)).toBeInTheDocument();
});
