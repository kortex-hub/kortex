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

import { expect, test } from '/@/fixtures/provider-fixtures';
import { CODING_AGENT, FILE_ACCESS_LEVEL, NETWORK_ACCESS_LEVEL } from '/@/model/core/types';

// Sandbox matrix lifecycle tests — see .agents/skills/playwright-testing/workspace-provider-e2e.md
import {
  CUSTOM_ALLOWED_HOST,
  CUSTOM_DEFAULT_TARGET_MOUNT,
  CUSTOM_MULTI_MOUNTS,
  CUSTOM_RO_MOUNT,
  CUSTOM_RW_MOUNT,
  FULL_SYSTEM_SKIP_LABEL,
  registerSandboxMatrixTests,
  type SandboxAgentSetup,
  type SandboxScenario,
  UNRESTRICTED_SKIP_LABEL,
} from './helpers/workspace-sandbox-matrix';

const AGENT_SETUPS: SandboxAgentSetup[] = [
  {
    testIdBase: 'OPENAI',
    describeAgent: 'OpenCode',
    agent: CODING_AGENT.OPENCODE,
    requiredResource: 'openai',
    workspacePrefix: 'opencode',
    selectModel: async createPage => createPage.searchAndSelectDefault('chat'),
    terminalReadyPatterns: [/Ask anything/i, /openai/i],
    promptTest: {
      prompt: 'what is 123+456? reply with just the number',
      expectedResponse: /579|insufficient|balance|credit|quota exceeded/i,
    },
  },
  {
    testIdBase: 'CLAUDE',
    describeAgent: 'Claude Code',
    agent: CODING_AGENT.CLAUDE,
    requiredResource: 'claude',
    workspacePrefix: 'claude',
    selectModel: async (createPage): Promise<string | undefined> => {
      await createPage.verifyModelRuntimes('Claude');
      return createPage.selectDefaultModel();
    },
    terminalReadyPatterns: [/Claude Code/],
    promptTest: {
      prompt: 'what is 2+2? reply with just the number',
      expectedResponse: /4|insufficient|balance|credit/i,
    },
  },
];

const SANDBOX_SCENARIOS: SandboxScenario[] = [
  // --- Core matrix ---
  {
    id: 'FS-NONE-NET-DEVELOPER',
    fileAccess: FILE_ACCESS_LEVEL.NO_HOST_ACCESS,
    network: NETWORK_ACCESS_LEVEL.DEVELOPER_PRESET,
  },
  {
    id: 'FS-HOME-NET-DEVELOPER',
    fileAccess: FILE_ACCESS_LEVEL.HOME_DIRECTORY,
    network: NETWORK_ACCESS_LEVEL.DEVELOPER_PRESET,
  },
  {
    id: 'FS-CUSTOM-NET-DEVELOPER',
    fileAccess: FILE_ACCESS_LEVEL.CUSTOM_PATHS,
    customMounts: CUSTOM_RW_MOUNT,
    network: NETWORK_ACCESS_LEVEL.DEVELOPER_PRESET,
  },
  {
    id: 'FS-NONE-NET-DENY',
    fileAccess: FILE_ACCESS_LEVEL.NO_HOST_ACCESS,
    network: NETWORK_ACCESS_LEVEL.DENY_ALL,
  },
  // --- Extended filesystem × network ---
  {
    id: 'FS-FULL-NET-DEVELOPER',
    fileAccess: FILE_ACCESS_LEVEL.FULL_SYSTEM,
    network: NETWORK_ACCESS_LEVEL.DEVELOPER_PRESET,
    skipReason: FULL_SYSTEM_SKIP_LABEL,
  },
  {
    id: 'FS-CUSTOM-NET-DENY',
    fileAccess: FILE_ACCESS_LEVEL.CUSTOM_PATHS,
    customMounts: CUSTOM_RW_MOUNT,
    network: NETWORK_ACCESS_LEVEL.DENY_ALL,
  },
  {
    id: 'FS-HOME-NET-DENY',
    fileAccess: FILE_ACCESS_LEVEL.HOME_DIRECTORY,
    network: NETWORK_ACCESS_LEVEL.DENY_ALL,
  },
  {
    id: 'FS-CUSTOM-RO-NET-DEVELOPER',
    fileAccess: FILE_ACCESS_LEVEL.CUSTOM_PATHS,
    customMounts: CUSTOM_RO_MOUNT,
    network: NETWORK_ACCESS_LEVEL.DEVELOPER_PRESET,
  },
  // --- Custom mount edge cases ---
  {
    id: 'FS-CUSTOM-DEFAULT-TARGET-NET-DEVELOPER',
    workspaceSlug: 'fs-cust-def-tgt',
    fileAccess: FILE_ACCESS_LEVEL.CUSTOM_PATHS,
    customMounts: CUSTOM_DEFAULT_TARGET_MOUNT,
    network: NETWORK_ACCESS_LEVEL.DEVELOPER_PRESET,
  },
  {
    id: 'FS-CUSTOM-MULTI-NET-DEVELOPER',
    fileAccess: FILE_ACCESS_LEVEL.CUSTOM_PATHS,
    customMounts: CUSTOM_MULTI_MOUNTS,
    network: NETWORK_ACCESS_LEVEL.DEVELOPER_PRESET,
  },
  // --- Network host allowlist edge cases ---
  {
    id: 'FS-NONE-NET-DENY-CUSTOM-HOST',
    fileAccess: FILE_ACCESS_LEVEL.NO_HOST_ACCESS,
    network: NETWORK_ACCESS_LEVEL.DENY_ALL,
    denyHosts: [CUSTOM_ALLOWED_HOST],
  },
  {
    id: 'FS-NONE-NET-DEVELOPER-ADDITIONAL-HOST',
    workspaceSlug: 'fs-none-dev-add-host',
    fileAccess: FILE_ACCESS_LEVEL.NO_HOST_ACCESS,
    network: NETWORK_ACCESS_LEVEL.DEVELOPER_PRESET,
    additionalHosts: [CUSTOM_ALLOWED_HOST],
  },
  // --- Known skips on OpenShell ---
  {
    id: 'FS-FULL-NET-DENY',
    fileAccess: FILE_ACCESS_LEVEL.FULL_SYSTEM,
    network: NETWORK_ACCESS_LEVEL.DENY_ALL,
    skipReason: FULL_SYSTEM_SKIP_LABEL,
  },
  {
    id: 'FS-NONE-NET-UNRESTRICTED',
    fileAccess: FILE_ACCESS_LEVEL.NO_HOST_ACCESS,
    network: NETWORK_ACCESS_LEVEL.UNRESTRICTED,
    skipReason: UNRESTRICTED_SKIP_LABEL,
  },
  {
    id: 'FS-HOME-NET-UNRESTRICTED',
    fileAccess: FILE_ACCESS_LEVEL.HOME_DIRECTORY,
    network: NETWORK_ACCESS_LEVEL.UNRESTRICTED,
    skipReason: UNRESTRICTED_SKIP_LABEL,
  },
  {
    id: 'FS-CUSTOM-NET-UNRESTRICTED',
    fileAccess: FILE_ACCESS_LEVEL.CUSTOM_PATHS,
    customMounts: CUSTOM_RW_MOUNT,
    network: NETWORK_ACCESS_LEVEL.UNRESTRICTED,
    skipReason: UNRESTRICTED_SKIP_LABEL,
  },
];

registerSandboxMatrixTests(test, expect, AGENT_SETUPS, SANDBOX_SCENARIOS);
