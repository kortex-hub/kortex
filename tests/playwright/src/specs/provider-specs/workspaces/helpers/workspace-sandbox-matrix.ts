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

import type { Expect } from '@playwright/test';

import type { test as providerTest } from '/@/fixtures/provider-fixtures';
import {
  FILE_ACCESS_LEVEL,
  type FileAccessLevel,
  NETWORK_ACCESS_LEVEL,
  type NetworkAccessLevel,
  PROVIDERS,
  type ResourceId,
  TIMEOUTS,
  type WorkspaceCustomMount,
} from '/@/model/core/types';
import type { AgentWorkspaceCreatePage } from '/@/model/pages/agent-workspace-create-page';

import { registerWorkspaceLifecycleTests } from './workspace-lifecycle-helper';

export const CUSTOM_MOUNT_TARGET = '$SOURCES/e2e-custom';
export const CUSTOM_MOUNT_TARGET_2 = '$SOURCES/e2e-custom-2';
export const CUSTOM_MOUNT_DEFAULT_HOST = '$SOURCES/e2e-default';
export const CUSTOM_ALLOWED_HOST = 'api.example.com';

function skipTestTitle(scenarioId: string, skipReason: string): string {
  return `[SKIP] ${scenarioId} — ${skipReason}`;
}

/** Must match packages/api SANDBOX_NAME_MAX_LENGTH (OpenShell DNS-1123 limit). */
export const SANDBOX_NAME_MAX_LENGTH = 19;

export const CUSTOM_RW_MOUNT: WorkspaceCustomMount[] = [{ host: '', target: CUSTOM_MOUNT_TARGET, readOnly: false }];
export const CUSTOM_RO_MOUNT: WorkspaceCustomMount[] = [{ host: '', target: CUSTOM_MOUNT_TARGET, readOnly: true }];
export const CUSTOM_DEFAULT_TARGET_MOUNT: WorkspaceCustomMount[] = [
  { host: CUSTOM_MOUNT_DEFAULT_HOST, readOnly: false },
];
export const CUSTOM_MULTI_MOUNTS: WorkspaceCustomMount[] = [
  { host: '', target: CUSTOM_MOUNT_TARGET, readOnly: false },
  { host: '', target: CUSTOM_MOUNT_TARGET_2, readOnly: false },
];

const FILESYSTEM_TAG: Record<FileAccessLevel, string> = {
  [FILE_ACCESS_LEVEL.NO_HOST_ACCESS]: '@fs-none',
  [FILE_ACCESS_LEVEL.CUSTOM_PATHS]: '@fs-custom',
};

const NETWORK_TAG: Record<NetworkAccessLevel, string> = {
  [NETWORK_ACCESS_LEVEL.DENY_ALL]: '@net-deny',
  [NETWORK_ACCESS_LEVEL.DEVELOPER_PRESET]: '@net-developer',
};

export interface SandboxScenario {
  /** Test ID segment after WKS-{AGENT}-, aligned with @fs-* / @net-* tags. */
  id: string;
  /**
   * Short kebab-case segment for the OpenShell sandbox name.
   * Final name is `{prefix}-{slug}` (≤ 19 chars). Prefer readable slugs
   * like `none-dev`, `cust-multi`, `deny-host` over single-letter codes.
   */
  workspaceSlug: string;
  fileAccess: FileAccessLevel;
  network: NetworkAccessLevel;
  customMounts?: WorkspaceCustomMount[];
  denyHosts?: string[];
  additionalHosts?: string[];
  skipReason?: string;
}

export interface SandboxAgentSetup {
  testIdBase: string;
  describeAgent: string;
  agent: Parameters<typeof registerWorkspaceLifecycleTests>[2]['agent'];
  requiredResource: ResourceId;
  workspacePrefix: string;
  selectModel: (createPage: AgentWorkspaceCreatePage) => Promise<string | undefined>;
  terminalReadyPatterns: readonly RegExp[];
  promptTest: {
    prompt: string;
    expectedResponse: RegExp;
  };
}

function filesystemLabel(scenario: SandboxScenario): string {
  switch (scenario.fileAccess) {
    case FILE_ACCESS_LEVEL.NO_HOST_ACCESS:
      return 'no host filesystem access';
    case FILE_ACCESS_LEVEL.CUSTOM_PATHS: {
      const mounts = scenario.customMounts;
      if (mounts?.some(mount => mount.readOnly)) {
        return 'custom read-only mount';
      }
      if (mounts && mounts.length > 1) {
        return 'multiple custom mounts';
      }
      if (mounts?.[0]?.host === CUSTOM_MOUNT_DEFAULT_HOST && mounts[0]?.target === undefined) {
        return 'custom mount with default target';
      }
      return 'custom read-write mount';
    }
    default: {
      const _exhaustive: never = scenario.fileAccess;
      return _exhaustive;
    }
  }
}

function networkLabel(scenario: SandboxScenario): string {
  switch (scenario.network) {
    case NETWORK_ACCESS_LEVEL.DENY_ALL:
      return scenario.denyHosts?.length ? 'deny-all network and custom allowed host' : 'deny-all network';
    case NETWORK_ACCESS_LEVEL.DEVELOPER_PRESET:
      return scenario.additionalHosts?.length
        ? 'developer preset network and additional allowed host'
        : 'developer preset network';
    default: {
      const _exhaustive: never = scenario.network;
      return _exhaustive;
    }
  }
}

function scenarioDescription(scenario: SandboxScenario): string {
  return `${filesystemLabel(scenario)} with ${networkLabel(scenario)}`;
}

function filesystemModifierTags(scenario: SandboxScenario): string[] {
  const mounts = scenario.customMounts;
  if (!mounts?.length) {
    return [];
  }

  const modifiers: string[] = [];
  if (mounts.length > 1) {
    modifiers.push('@fs-custom-multi');
  }
  if (mounts.some(mount => mount.readOnly)) {
    modifiers.push('@fs-custom-ro');
  }
  if (mounts[0]?.host === CUSTOM_MOUNT_DEFAULT_HOST && mounts[0]?.target === undefined) {
    modifiers.push('@fs-custom-default-target');
  }
  return modifiers;
}

function networkModifierTags(scenario: SandboxScenario): string[] {
  const modifiers: string[] = [];
  if (scenario.denyHosts?.length) {
    modifiers.push('@net-custom-host');
  }
  if (scenario.additionalHosts?.length) {
    modifiers.push('@net-additional-host');
  }
  return modifiers;
}

export function buildScenarioTags(scenario: SandboxScenario): string[] {
  return [
    '@workspace-sandbox',
    FILESYSTEM_TAG[scenario.fileAccess],
    NETWORK_TAG[scenario.network],
    ...filesystemModifierTags(scenario),
    ...networkModifierTags(scenario),
  ];
}

export function buildWorkspaceName(workspacePrefix: string, slug: string): string {
  const workspaceName = `${workspacePrefix}-${slug}`;
  if (workspaceName.length > SANDBOX_NAME_MAX_LENGTH) {
    throw new Error(
      `Workspace name "${workspaceName}" is ${workspaceName.length} chars; ` +
        `must be ≤ ${SANDBOX_NAME_MAX_LENGTH} (OpenShell sandbox name limit)`,
    );
  }
  return workspaceName;
}

export function registerSandboxMatrixTests(
  test: typeof providerTest,
  expect: Expect,
  agents: SandboxAgentSetup[],
  scenarios: SandboxScenario[],
): void {
  for (const agent of agents) {
    test.describe(agent.describeAgent, () => {
      const provider = PROVIDERS[agent.requiredResource];
      const managesResource = !('autoDetected' in provider && provider.autoDetected);

      test.beforeAll(async ({ workerNavigationBar }) => {
        await workerNavigationBar.ensureExtensionsRunning();

        if (managesResource) {
          const credentials = process.env[provider.envVarName];
          if (!credentials) {
            return;
          }
          const settingsPage = await workerNavigationBar.navigateToSettingsPage();
          await settingsPage.createResource(agent.requiredResource, credentials);
          await workerNavigationBar.navigateToWorkspacesPage();
        }
      });

      test.afterAll(async ({ workerNavigationBar }) => {
        if (!managesResource || !process.env[provider.envVarName]) {
          return;
        }
        try {
          const settingsPage = await workerNavigationBar.navigateToSettingsPage();
          await settingsPage.deleteResource(agent.requiredResource);
        } catch (error) {
          console.error(`Failed to delete ${agent.requiredResource} resource:`, error);
        }
      });

      for (const scenario of scenarios) {
        const workspaceName = buildWorkspaceName(agent.workspacePrefix, scenario.workspaceSlug);
        const description = scenarioDescription(scenario);
        const describeOptions = { tag: buildScenarioTags(scenario) };

        if (scenario.skipReason) {
          test.describe.skip(scenario.id, describeOptions, () => {
            test(skipTestTitle(scenario.id, scenario.skipReason!), () => {});
          });
          continue;
        }

        test.describe.serial(scenario.id, describeOptions, () => {
          registerWorkspaceLifecycleTests(test, expect, {
            testIdPrefix: `WKS-${agent.testIdBase}-${scenario.id}`,
            scenarioId: scenario.id,
            workspaceName,
            agent: agent.agent,
            requiredResource: agent.requiredResource,
            manageResource: false,
            selectModel: agent.selectModel,
            terminalReadyPatterns: agent.terminalReadyPatterns,
            promptTimeout: TIMEOUTS.MODEL_RESPONSE,
            promptTest: agent.promptTest,
            sandbox: {
              fileAccess: scenario.fileAccess,
              customMounts: scenario.customMounts,
              network: scenario.network,
              denyHosts: scenario.denyHosts,
              additionalHosts: scenario.additionalHosts,
              summary: description,
            },
          });
        });
      }
    });
  }
}
