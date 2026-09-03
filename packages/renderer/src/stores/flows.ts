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
import type { Writable } from 'svelte/store';
import { writable } from 'svelte/store';

import PodIcon from '/@/lib/images/PodIcon.svelte';
import { EventStore } from '/@/stores/event-store';
import type { FlowInfo } from '/@api/flow-info';

const windowEvents = ['extension-stopped', 'extensions-started', 'extension-started', 'flow:updated'];
const windowListeners = ['extensions-already-started'];

let readyToUpdate = false;

export async function checkForUpdate(eventName: string): Promise<boolean> {
  if ('extensions-already-started' === eventName) {
    readyToUpdate = true;
  }

  // do not fetch until extensions are all started
  return readyToUpdate;
}

export const flowsInfos: Writable<Array<FlowInfo>> = writable([]);

const listFlows = (): Promise<Array<FlowInfo>> => {
  return window.listFlows();
};

export const flowsEventStore = new EventStore<Array<FlowInfo>>(
  'flows',
  flowsInfos,
  checkForUpdate,
  windowEvents,
  windowListeners,
  listFlows,
  PodIcon,
);
flowsEventStore.setupWithDebounce();
