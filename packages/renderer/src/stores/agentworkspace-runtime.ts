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

import { type Writable, writable } from 'svelte/store';

import { AgentWorkspaceSettings } from '/@api/agent-workspace/agent-workspace-settings';

import { configurationProperties } from './configurationProperties';

const AGENT_WORKSPACE_RUNTIME = `${AgentWorkspaceSettings.SectionName}.${AgentWorkspaceSettings.Runtime}`;
const DEFAULT_RUNTIME = 'podman';
let requestId = 0;

export const agentWorkspaceRuntime: Writable<string> = writable(DEFAULT_RUNTIME);

configurationProperties.subscribe(() => {
  if (!window?.getConfigurationValue) {
    return;
  }

  const currentRequestId = ++requestId;
  window
    .getConfigurationValue<string>(AGENT_WORKSPACE_RUNTIME)
    ?.then(value => {
      if (currentRequestId === requestId) {
        agentWorkspaceRuntime.set(value ?? DEFAULT_RUNTIME);
      }
    })
    ?.catch((err: unknown) => console.error(`Error getting configuration value ${AGENT_WORKSPACE_RUNTIME}`, err));
});
