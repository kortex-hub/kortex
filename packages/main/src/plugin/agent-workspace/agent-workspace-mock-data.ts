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

import type {
  AgentWorkspaceConfiguration,
  AgentWorkspaceId,
  AgentWorkspaceSummary,
} from '/@api/agent-workspace-info.js';

/**
 * Mock CLI responses.
 * Each function simulates a distinct `kortex` CLI command.
 * When the real CLI is integrated, each function will be replaced by
 * an actual `exec('kortex', [...])` invocation + JSON.parse(stdout).
 */

const INITIAL_SUMMARIES: AgentWorkspaceSummary[] = [
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

/**
 * Mock workspace configurations keyed by workspace id.
 * Simulates reading + parsing the YAML file at paths.configuration.
 */
const CONFIGURATIONS: Record<string, AgentWorkspaceConfiguration> = {
  'mock-ws-api-refactor': {
    name: 'api-refactor',
  },
  'mock-ws-test-suite': {
    name: 'test-suite-fix',
  },
  'mock-ws-frontend': {
    name: 'frontend-redesign',
  },
};

const store: AgentWorkspaceSummary[] = structuredClone(INITIAL_SUMMARIES);

// Future: exec('kortex', ['workspace', 'list', '--format', 'json'])
export function mockListWorkspaces(): AgentWorkspaceSummary[] {
  return structuredClone(store);
}

// Future: exec('kortex', ['workspace', 'remove', id, '--format', 'json'])
export function mockRemoveWorkspace(id: string): AgentWorkspaceId {
  const idx = store.findIndex(ws => ws.id === id);
  if (idx === -1) {
    throw new Error(`workspace "${id}" not found. Use "workspace list" to see available workspaces.`);
  }
  store.splice(idx, 1);
  return { id };
}

// Future: readFile(paths.configuration) + YAML.parse() validated against WorkspaceConfiguration schema
export function mockGetWorkspaceConfiguration(id: string): AgentWorkspaceConfiguration {
  const config = CONFIGURATIONS[id];
  if (!config) {
    throw new Error(`workspace "${id}" not found. Use "workspace list" to see available workspaces.`);
  }
  return structuredClone(config);
}
