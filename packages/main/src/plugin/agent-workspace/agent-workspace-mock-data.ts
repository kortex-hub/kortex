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

import type { AgentWorkspaceSummary } from '/@api/agent-workspace-info.js';

/**
 * Mock CLI responses.
 * Each function simulates a distinct `kortex` CLI command.
 * When the real CLI is integrated, each function will be replaced by
 * an actual `exec('kortex', [...])` invocation + JSON.parse(stdout).
 */

const SUMMARIES: AgentWorkspaceSummary[] = [
  {
    id: 'mock-ws-api-refactor',
    name: 'api-refactor',
    paths: {
      source: '/home/user/projects/backend',
      configuration: '/home/user/.config/kortex/workspaces/api-refactor.yaml',
    },
  },
  {
    id: 'mock-ws-test-suite',
    name: 'test-suite-fix',
    paths: {
      source: '/home/user/projects/backend',
      configuration: '/home/user/.config/kortex/workspaces/test-suite-fix.yaml',
    },
  },
  {
    id: 'mock-ws-frontend',
    name: 'frontend-redesign',
    paths: {
      source: '/home/user/projects/frontend',
      configuration: '/home/user/.config/kortex/workspaces/frontend-redesign.yaml',
    },
  },
];

// Future: exec('kortex', ['workspace', 'list', '--format', 'json'])
export function mockListWorkspaces(): AgentWorkspaceSummary[] {
  return structuredClone(SUMMARIES);
}
