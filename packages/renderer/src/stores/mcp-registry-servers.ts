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
import { derived, writable } from 'svelte/store';

import { findMatchInLeaves } from '/@/stores/search-util';
import type { MCPServerDetail } from '/@api/mcp/mcp-server-info';

export const mcpRegistriesServerInfos: Writable<readonly MCPServerDetail[]> = writable([]);

export const mcpRegistriesServerInfosSearchPattern = writable('');

export const filteredMcpRegistriesServerInfos = derived(
  [mcpRegistriesServerInfosSearchPattern, mcpRegistriesServerInfos],
  ([$mcpRegistriesServerInfosSearchPattern, $mcpRegistriesServerInfos]) => {
    return $mcpRegistriesServerInfosSearchPattern.trim().length
      ? $mcpRegistriesServerInfos.filter(registry =>
          findMatchInLeaves(registry, $mcpRegistriesServerInfosSearchPattern),
        )
      : $mcpRegistriesServerInfos;
  },
);

export async function fetchMcpRegistryServers(): Promise<void> {
  const registries = await window.getMcpRegistryServers();
  mcpRegistriesServerInfos.set(registries);
}

// need to refresh when new registry are updated/deleted
window.events?.receive('mcp-registry-register', () => {
  fetchMcpRegistryServers().catch((error: unknown) => {
    console.error('Failed to fetch registries entries', error);
  });
});

window.events?.receive('mcp-registry-unregister', () => {
  fetchMcpRegistryServers().catch((error: unknown) => {
    console.error('Failed to fetch registries entries', error);
  });
});

window.events?.receive('mcp-registry-update', () => {
  fetchMcpRegistryServers().catch((error: unknown) => {
    console.error('Failed to fetch registries entries', error);
  });
});

window.addEventListener('system-ready', () => {
  fetchMcpRegistryServers().catch((error: unknown) => {
    console.error('Failed to fetch registries entries', error);
  });
});

window.events?.receive('extensions-started', () => {
  fetchMcpRegistryServers().catch((error: unknown) => {
    console.error('Failed to fetch registries entries', error);
  });
});
