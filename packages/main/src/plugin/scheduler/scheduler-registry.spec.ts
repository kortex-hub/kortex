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

import type { ProviderScheduler } from '@kortex-app/api';
import { Container } from 'inversify';
import { beforeEach, expect, test, vi } from 'vitest';

import { ApiSenderType, IPCHandle } from '/@/plugin/api.js';
import type { ProviderImpl } from '/@/plugin/provider-impl.js';
import { SchedulerRegistry } from '/@/plugin/scheduler/scheduler-registry.js';

const providerImpl1 = {
  id: 'provider-1',
  name: 'provider-name-1',
  internalId: 'internal-1',
} as unknown as ProviderImpl;

const providerImpl2 = {
  id: 'provider-2',
  name: 'provider-name-2',
  internalId: 'internal-2',
} as unknown as ProviderImpl;

const scheduler1: ProviderScheduler = {
  name: 'scheduler-1',
  schedule: vi.fn(),
  cancel: vi.fn(),
  list: vi.fn(),
  getExecution: vi.fn(),
};

const scheduler2: ProviderScheduler = {
  name: 'scheduler-2',
  schedule: vi.fn(),
  cancel: vi.fn(),
  list: vi.fn(),
  getExecution: vi.fn(),
};

const apiSenderMock = {
  send: vi.fn(),
} as unknown as ApiSenderType;

const ipcHandleMock = vi.fn();

let schedulerRegistry: SchedulerRegistry;

beforeEach(() => {
  vi.resetAllMocks();
  const container = new Container();
  container.bind(SchedulerRegistry).toSelf().inSingletonScope();
  container.bind(ApiSenderType).toConstantValue(apiSenderMock);
  container.bind(IPCHandle).toConstantValue(ipcHandleMock);
  schedulerRegistry = container.get(SchedulerRegistry);
});

test('should initialize without error', async () => {
  await expect(schedulerRegistry.init()).resolves.toBeUndefined();
});

test('should register a scheduler and send event', () => {
  const disposable = schedulerRegistry.register(providerImpl1, scheduler1);

  expect(apiSenderMock.send).toHaveBeenCalledWith('provider-scheduler-change', {
    providerId: providerImpl1.id,
    name: scheduler1.name,
  });
  expect(apiSenderMock.send).toHaveBeenCalledTimes(1);
  expect(disposable).toBeDefined();
  expect(typeof disposable.dispose).toBe('function');
});

test('should register multiple schedulers', () => {
  schedulerRegistry.register(providerImpl1, scheduler1);
  schedulerRegistry.register(providerImpl2, scheduler2);

  expect(apiSenderMock.send).toHaveBeenCalledTimes(2);
  expect(apiSenderMock.send).toHaveBeenNthCalledWith(1, 'provider-scheduler-change', {
    providerId: providerImpl1.id,
    name: scheduler1.name,
  });
  expect(apiSenderMock.send).toHaveBeenNthCalledWith(2, 'provider-scheduler-change', {
    providerId: providerImpl2.id,
    name: scheduler2.name,
  });
});

test('should unregister scheduler when disposable is called', () => {
  const disposable = schedulerRegistry.register(providerImpl1, scheduler1);

  expect(apiSenderMock.send).toHaveBeenCalledTimes(1);

  // Dispose the scheduler
  disposable.dispose();

  expect(apiSenderMock.send).toHaveBeenCalledTimes(2);
  expect(apiSenderMock.send).toHaveBeenNthCalledWith(2, 'provider-scheduler-change', {
    providerId: providerImpl1.id,
    name: scheduler1.name,
  });
});

test('should dispose and clear all schedulers', () => {
  schedulerRegistry.register(providerImpl1, scheduler1);
  schedulerRegistry.register(providerImpl2, scheduler2);

  expect(apiSenderMock.send).toHaveBeenCalledTimes(2);

  // Dispose the registry
  schedulerRegistry.dispose();

  // No additional events should be sent on dispose
  expect(apiSenderMock.send).toHaveBeenCalledTimes(2);
});

test('should handle multiple dispose calls on the same disposable', () => {
  const disposable = schedulerRegistry.register(providerImpl1, scheduler1);

  disposable.dispose();
  disposable.dispose(); // Second dispose should not cause issues

  // Should only send 2 events (1 register, 1 unregister)
  expect(apiSenderMock.send).toHaveBeenCalledTimes(2);
});
