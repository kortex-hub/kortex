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

import { get } from 'svelte/store';
import { beforeEach, expect, test, vi } from 'vitest';

import type { GatewayInfo } from '/@api/openshell-gateway-info';

const callbacks = new Map<string, () => Promise<void> | void>();
const eventEmitter = {
  receive: (message: string, callback: () => Promise<void> | void): void => {
    callbacks.set(message, callback);
  },
};

beforeEach(() => {
  callbacks.clear();
  vi.resetAllMocks();
  vi.resetModules();
  Object.defineProperty(window, 'events', {
    value: {
      receive: vi.fn(eventEmitter.receive),
    },
    configurable: true,
  });
  vi.spyOn(window, 'addEventListener').mockImplementation(eventEmitter.receive as typeof window.addEventListener);
});

test('does not fetch gateways before extensions are started', async () => {
  const { openshellGateways } = await import('./openshell-gateways');

  vi.mocked(window.listOpenshellGateways).mockResolvedValue([{ name: 'local', endpoint: 'http://127.0.0.1:17670' }]);

  await callbacks.get('openshell-registry:gateway-update')?.();

  expect(window.listOpenshellGateways).not.toHaveBeenCalled();
  expect(get(openshellGateways)).toEqual([]);
});

test('populates gateways when extensions are started', async () => {
  const { openshellGateways } = await import('./openshell-gateways');
  const gateways: GatewayInfo[] = [
    {
      name: 'local',
      endpoint: 'http://127.0.0.1:17670',
      active: true,
      auth: 'plaintext',
      type: 'local',
      source: 'user',
    },
  ];
  vi.mocked(window.listOpenshellGateways).mockResolvedValue(gateways);

  await callbacks.get('extensions-already-started')?.();

  await vi.waitFor(() => {
    expect(window.listOpenshellGateways).toHaveBeenCalled();
    expect(get(openshellGateways)).toEqual(gateways);
  });
});

test('refreshes gateways on OpenShell registry gateway updates after startup', async () => {
  const { openshellGateways } = await import('./openshell-gateways');
  const initialGateways: GatewayInfo[] = [{ name: 'local', endpoint: 'http://127.0.0.1:17670', active: true }];
  const updatedGateways: GatewayInfo[] = [
    ...initialGateways,
    {
      name: 'production',
      endpoint: 'https://gateway.example.com',
      active: false,
      auth: 'mtls',
      type: 'remote',
      source: 'user',
      is_remote: true,
      remote_host: 'user@gateway.example.com',
      resolved_host: '10.0.0.5',
    },
  ];
  vi.mocked(window.listOpenshellGateways).mockResolvedValueOnce(initialGateways).mockResolvedValueOnce(updatedGateways);

  await callbacks.get('extensions-already-started')?.();
  await vi.waitFor(() => expect(get(openshellGateways)).toEqual(initialGateways));

  await callbacks.get('openshell-registry:gateway-update')?.();

  await vi.waitFor(() => {
    expect(window.listOpenshellGateways).toHaveBeenCalledTimes(2);
    expect(get(openshellGateways)).toEqual(updatedGateways);
  });
});

test('refreshes gateways on agent gateway updates after startup', async () => {
  const { openshellGateways } = await import('./openshell-gateways');
  const initialGateways: GatewayInfo[] = [{ name: 'local', endpoint: 'http://127.0.0.1:17670', active: true }];
  const updatedGateways: GatewayInfo[] = [
    { name: 'local', endpoint: 'http://127.0.0.1:17670', active: true, auth: 'plaintext', type: 'local' },
  ];
  vi.mocked(window.listOpenshellGateways).mockResolvedValueOnce(initialGateways).mockResolvedValueOnce(updatedGateways);

  await callbacks.get('extensions-already-started')?.();
  await vi.waitFor(() => expect(get(openshellGateways)).toEqual(initialGateways));

  await callbacks.get('agent-gateway-update')?.();

  await vi.waitFor(() => {
    expect(window.listOpenshellGateways).toHaveBeenCalledTimes(2);
    expect(get(openshellGateways)).toEqual(updatedGateways);
  });
});
