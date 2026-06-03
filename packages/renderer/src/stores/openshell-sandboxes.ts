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

import { derived, type Writable, writable } from 'svelte/store';

import type { GatewaySandboxes, SandboxInfo } from '/@api/openshell-gateway-info';

import { EventStore } from './event-store';

const windowEvents = ['agent-workspace-update'];
const windowListeners = ['extensions-already-started'];

let readyToUpdate = false;

export async function checkForUpdate(eventName: string): Promise<boolean> {
  if ('extensions-already-started' === eventName) {
    readyToUpdate = true;
  }

  // do not fetch until extensions are all started
  return readyToUpdate;
}

export const openshellSandboxes: Writable<GatewaySandboxes[]> = writable([]);

const listOpenshellSandboxes = (): Promise<GatewaySandboxes[]> => {
  return window.listOpenshellSandboxes();
};

export const openshellSandboxesEventStore = new EventStore<GatewaySandboxes[]>(
  'openshell-sandboxes',
  openshellSandboxes,
  checkForUpdate,
  windowEvents,
  windowListeners,
  listOpenshellSandboxes,
);
openshellSandboxesEventStore.setup();

export interface SandboxInfoWithGateway extends SandboxInfo {
  gatewayName: string;
}

// Derived store: flatten all sandboxes across gateways and add gateway name for easier UI consumption
export const allOpenshellSandboxes = derived(openshellSandboxes, $sandboxes => {
  const flattened: SandboxInfoWithGateway[] = [];
  for (const gatewaySandboxes of $sandboxes) {
    for (const sandbox of gatewaySandboxes.sandboxes) {
      flattened.push({
        ...sandbox,
        gatewayName: gatewaySandboxes.gateway.name,
      });
    }
  }
  return flattened;
});

// Search pattern for filtering sandboxes
export const searchPattern = writable('');

// Derived store: filtered sandboxes based on search pattern
export const filteredOpenshellSandboxes = derived(
  [searchPattern, allOpenshellSandboxes],
  ([$searchPattern, $allSandboxes]) => {
    const term = $searchPattern.trim().toLowerCase();
    if (!term) {
      return $allSandboxes;
    }
    return $allSandboxes.filter(
      sandbox =>
        sandbox.name.toLowerCase().includes(term) ||
        sandbox.id.toLowerCase().includes(term) ||
        sandbox.gatewayName.toLowerCase().includes(term),
    );
  },
);
