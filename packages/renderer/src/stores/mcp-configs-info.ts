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

import { EventStore } from '/@/stores/event-store';
import { findMatchInLeaves } from '/@/stores/search-util';
import type { MCPConfigInfo } from '/@api/mcp/mcp-config-info';
import { MCPEvents } from '/@api/mcp/mcp-events';

const windowEvents: Array<string> = [
  MCPEvents.MCP_REGISTERED,
  MCPEvents.MCP_UNREGISTERED,
  MCPEvents.MCP_START,
  MCPEvents.MCP_STOP,
];

const windowListeners: Array<string> = ['system-ready'];

export async function checkForUpdate(): Promise<boolean> {
  return true;
}

export const mcpConfigsInfo: Writable<MCPConfigInfo[]> = writable([]);

export const mcpConfigsInfoEventStore = new EventStore<Array<MCPConfigInfo>>(
  'MCP Configs',
  mcpConfigsInfo,
  checkForUpdate,
  windowEvents,
  windowListeners,
  window.collectMCPStatuses,
);
mcpConfigsInfoEventStore.setup();

export const mcpRemoteServerInfoSearchPattern = writable('');

export const filteredMcpRemoteServerInfos = derived(
  [mcpConfigsInfo, mcpRemoteServerInfoSearchPattern],
  ([$mcpRemoteServerInfos, $mcpRemoteServerInfoSearchPattern]) => {
    return $mcpRemoteServerInfoSearchPattern.trim().length
      ? $mcpRemoteServerInfos.filter(server => findMatchInLeaves(server, $mcpRemoteServerInfoSearchPattern))
      : $mcpRemoteServerInfos;
  },
);
