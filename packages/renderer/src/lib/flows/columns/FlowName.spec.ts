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

import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/svelte';
import { expect, test } from 'vitest';

import type { FlowInfo } from '/@api/flow-info';

import FlowName from './FlowName.svelte';

test('Display flow name as main text and flow path as secondary text', () => {
  const flowInfo: FlowInfo = {
    providerId: 'provider1',
    connectionName: 'connection1',
    id: 'flow1',
    path: '/some/path',
    name: 'Flow 1',
  };
  render(FlowName, { object: flowInfo });

  expect(screen.getByText('/some/path')).toBeInTheDocument();
  expect(screen.getByText('Flow 1')).toBeInTheDocument();
});
