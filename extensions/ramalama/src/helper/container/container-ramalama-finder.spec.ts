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

import type { ContainerInfo } from 'dockerode';
import { beforeEach, expect, test, vi } from 'vitest';

import { ContainerRamaLamaFinder } from './container-ramalama-finder';

beforeEach(async () => {
  vi.resetAllMocks();
});

test('getRamaLamaContainers filters containers with ai.ramalama label', async () => {
  const containerRamaLamaFinder = new ContainerRamaLamaFinder();

  const containers = [
    { Id: '1', Names: ['/container1'], Labels: { 'ai.ramalama': 'true' } },
    { Id: '2', Names: ['/container2'], Labels: {} },
    { Id: '3', Names: ['/container3'], Labels: { 'ai.ramalama': 'true' } },
    { Id: '4', Names: ['/container4'] }, // No labels
  ] as unknown as ContainerInfo[];

  const ramaLamaContainers = await containerRamaLamaFinder.getRamaLamaContainers(containers);

  expect(ramaLamaContainers).toHaveLength(2);
  expect(ramaLamaContainers.map(c => c.Id)).toEqual(['1', '3']);
});
