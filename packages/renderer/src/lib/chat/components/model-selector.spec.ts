/**********************************************************************
 * Copyright (C) 2026 Red Hat, Inc.
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

import { beforeEach, describe, expect, test, vi } from 'vitest';

import type { ModelInfo } from '/@/lib/chat/components/model-info';

import { groupAndSortModels } from './model-selector.svelte';

beforeEach(() => {
  vi.resetAllMocks();
});

describe('ModelSelector', () => {
  test('should sort models alphabetically within a single group', () => {
    const models: ModelInfo[] = [
      { providerId: 'provider1', connectionName: 'connection1', label: 'Zebra Model' },
      { providerId: 'provider1', connectionName: 'connection1', label: 'Alpha Model' },
      { providerId: 'provider1', connectionName: 'connection1', label: 'Model Beta' },
    ];

    const groups = groupAndSortModels(models);
    const provider1Models = groups.get('provider1:connection1')!;

    expect(provider1Models).toHaveLength(3);
    expect(provider1Models[0].label).toBe('Alpha Model');
    expect(provider1Models[1].label).toBe('Model Beta');
    expect(provider1Models[2].label).toBe('Zebra Model');
  });

  test('should sort models alphabetically across multiple groups', () => {
    const models: ModelInfo[] = [
      { providerId: 'provider1', connectionName: 'connection1', label: 'Zebra' },
      { providerId: 'provider1', connectionName: 'connection1', label: 'Alpha' },
      { providerId: 'provider2', connectionName: 'connection2', label: 'Zulu' },
      { providerId: 'provider2', connectionName: 'connection2', label: 'Bravo' },
    ];

    const groups = groupAndSortModels(models);

    // First group should be sorted
    const provider1Models = groups.get('provider1:connection1')!;
    expect(provider1Models[0].label).toBe('Alpha');
    expect(provider1Models[1].label).toBe('Zebra');

    // Second group should also be sorted
    const provider2Models = groups.get('provider2:connection2')!;
    expect(provider2Models[0].label).toBe('Bravo');
    expect(provider2Models[1].label).toBe('Zulu');
  });

  test('should handle case-insensitive sorting', () => {
    const models: ModelInfo[] = [
      { providerId: 'provider1', connectionName: 'connection1', label: 'model-c' },
      { providerId: 'provider1', connectionName: 'connection1', label: 'Model-B' },
      { providerId: 'provider1', connectionName: 'connection1', label: 'MODEL-A' },
    ];

    const groups = groupAndSortModels(models);
    const provider1Models = groups.get('provider1:connection1')!;

    // localeCompare handles case-insensitive comparison
    expect(provider1Models[0].label).toBe('MODEL-A');
    expect(provider1Models[1].label).toBe('Model-B');
    expect(provider1Models[2].label).toBe('model-c');
  });

  test('should handle special characters and numbers in model names', () => {
    const models: ModelInfo[] = [
      { providerId: 'provider1', connectionName: 'connection1', label: 'model-3.5-turbo' },
      { providerId: 'provider1', connectionName: 'connection1', label: 'model-4' },
      { providerId: 'provider1', connectionName: 'connection1', label: 'model-4-turbo' },
      { providerId: 'provider1', connectionName: 'connection1', label: 'model-3' },
    ];

    const groups = groupAndSortModels(models);
    const provider1Models = groups.get('provider1:connection1')!;

    // localeCompare provides natural string sorting
    expect(provider1Models[0].label).toBe('model-3');
    expect(provider1Models[1].label).toBe('model-3.5-turbo');
    expect(provider1Models[2].label).toBe('model-4');
    expect(provider1Models[3].label).toBe('model-4-turbo');
  });

  test('should maintain separate sorted groups for different providers', () => {
    const models: ModelInfo[] = [
      { providerId: 'provider1', connectionName: 'connection1', label: 'Model Z' },
      { providerId: 'provider1', connectionName: 'connection1', label: 'Model A' },
      { providerId: 'provider2', connectionName: 'connection2', label: 'Model C' },
      { providerId: 'provider2', connectionName: 'connection2', label: 'Model B' },
    ];

    const groups = groupAndSortModels(models);

    // Should have two separate groups
    expect(groups.size).toBe(2);
    expect(groups.get('provider1:connection1')).toHaveLength(2);
    expect(groups.get('provider2:connection2')).toHaveLength(2);

    // Each group should be independently sorted
    expect(groups.get('provider1:connection1')![0].label).toBe('Model A');
    expect(groups.get('provider1:connection1')![1].label).toBe('Model Z');
    expect(groups.get('provider2:connection2')![0].label).toBe('Model B');
    expect(groups.get('provider2:connection2')![1].label).toBe('Model C');
  });
});
