/**********************************************************************
 * Copyright (C) 2024-2025 Red Hat, Inc.
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

import { type Writable, writable } from 'svelte/store';

import type { ChunkProviderInfo } from '/@api/rag/chunk-provider-info';

import { EventStore } from './event-store';

const windowEvents = ['chunker-provider-update', 'chunker-provider-remove', 'extensions-started'];
const windowListeners = ['system-ready'];

export async function checkForUpdate(): Promise<boolean> {
  return true;
}

export const chunkProviders: Writable<ChunkProviderInfo[]> = writable([]);

const eventStore = new EventStore<ChunkProviderInfo[]>(
  'chunk-providers',
  chunkProviders,
  checkForUpdate,
  windowEvents,
  windowListeners,
  fetchChunkProviders,
);
eventStore.setup();

export async function fetchChunkProviders(): Promise<ChunkProviderInfo[]> {
  const result = await window.getChunkProviders();
  chunkProviders.set(result);
  return result;
}
