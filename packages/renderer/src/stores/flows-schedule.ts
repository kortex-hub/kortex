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

import FlowIcon from '/@/lib/images/FlowIcon.svelte';
import { EventStore } from '/@/stores/event-store';
import type { FlowScheduleInfo } from '/@api/flow-schedule-info';

const windowEvents = ['provider-scheduler-change', 'scheduler-updated-entry'];
const windowListeners = ['extensions-already-started'];

let readyToUpdate = false;

export async function checkForUpdate(eventName: string): Promise<boolean> {
  if ('extensions-already-started' === eventName) {
    readyToUpdate = true;
  }

  // do not fetch until extensions are all started
  return readyToUpdate;
}

export const scheduledFlowsInfo: Writable<Array<FlowScheduleInfo>> = writable([]);

const listScheduledFlows = async (): Promise<Array<FlowScheduleInfo>> => {
  return window.listScheduledFlows();
};

export const flowsEventStore = new EventStore<Array<FlowScheduleInfo>>(
  'scheduledFlows',
  scheduledFlowsInfo,
  checkForUpdate,
  windowEvents,
  windowListeners,
  listScheduledFlows,
  FlowIcon,
);
flowsEventStore.setupWithDebounce();
