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

import { beforeEach, expect, test, vi } from 'vitest';

import type { RamalamaContainerInfo } from '/@/api/ramalama-container-info';

import { ContainerModelExtractor } from './container-model-extractor';

beforeEach(async () => {
  vi.resetAllMocks();
});

test('extractModelInfo ', async () => {
  const containerModelExtractor = new ContainerModelExtractor();

  // test the extraction of model info from a RamalamaContainerInfo
  const container = {
    Id: '1',
    Names: ['/container1'],
    Labels: {
      'ai.ramalama': 'true',
      'ai.ramalama.model': 'granite-4',
      'ai.ramalama.port': '8080',
    },
  } as unknown as RamalamaContainerInfo;

  const modelInfo = await containerModelExtractor.extractModelInfo(container);
  expect(modelInfo.name).toBe('granite-4');
  expect(modelInfo.port).toBe(8080);
});

test('extractModelInfo without port ', async () => {
  const containerModelExtractor = new ContainerModelExtractor();

  // test the extraction of model info from a RamalamaContainerInfo
  const container = {
    Id: '1',
    Names: ['/container1'],
    Labels: {
      'ai.ramalama': 'true',
      'ai.ramalama.model': 'granite-4',
    },
  } as unknown as RamalamaContainerInfo;

  const modelInfo = await containerModelExtractor.extractModelInfo(container);
  expect(modelInfo.name).toBe('granite-4');
  // port should default to 0 if not specified
  expect(modelInfo.port).toBe(0);
});
