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

export const FULL_SYSTEM_SKIP_LABEL = 'OpenShell tar fails on / mount';
export const UNRESTRICTED_SKIP_LABEL = 'Unrestricted network disabled on OpenShell';

function skipTestTitle(scenarioId: string, skipReason: string): string {
  return `[SKIP] ${scenarioId} — ${skipReason}`;
}

/** OpenShell prefixes container names with this; crun rejects hostnames longer than 64 bytes. */
export const OPENSHELL_CONTAINER_NAME_PREFIX = 'openshell-sandbox-';
export const OPENSHELL_MAX_HOSTNAME_LENGTH = 64;
export const WORKSPACE_NAME_SUFFIX = '-e2e';

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
  [FILE_ACCESS_LEVEL.HOME_DIRECTORY]: '@fs-home',
  [FILE_ACCESS_LEVEL.CUSTOM_PATHS]: '@fs-custom',
  [FILE_ACCESS_LEVEL.FULL_SYSTEM]: '@fs-full',
};

const NETWORK_TAG: Record<NetworkAccessLevel, string> = {
  [NETWORK_ACCESS_LEVEL.DENY_ALL]: '@net-deny',
  [NETWORK_ACCESS_LEVEL.DEVELOPER_PRESET]: '@net-developer',
  [NETWORK_ACCESS_LEVEL.UNRESTRICTED]: '@net-unrestricted',
};

export interface SandboxScenario {
  /** Test ID segment after WKS-{AGENT}-, aligned with @fs-* / @net-* tags. */
  id: string;
  /**
   * Short kebab-case segment for the OpenShell sandbox name when `id` is too long.
   * Defaults to `id.toLowerCase()`. Must keep `openshell-sandbox-{prefix}-{slug}-e2e` ≤ 64 chars.
   */
  workspaceSlug?: string;
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
  terminalReadyPatterns: RegExp[];
  promptTest: {
    prompt: string;
    expectedResponse: RegExp;
  };
}

function filesystemLabel(scenario: SandboxScenario): string {
  switch (scenario.fileAccess) {
    case FILE_ACCESS_LEVEL.NO_HOST_ACCESS:
      return 'no host filesystem access';
    case FILE_ACCESS_LEVEL.HOME_DIRECTORY:
      return 'home directory filesystem';
    case FILE_ACCESS_LEVEL.FULL_SYSTEM:
      return 'full system filesystem';
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
    case NETWORK_ACCESS_LEVEL.UNRESTRICTED:
      return 'unrestricted network';
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
  return `${workspacePrefix}-${slug}${WORKSPACE_NAME_SUFFIX}`;
}

export function openshellContainerName(workspaceName: string): string {
  return `${OPENSHELL_CONTAINER_NAME_PREFIX}${workspaceName}`;
}

export function assertOpenshellContainerNameFits(workspaceName: string, context: string): void {
  const containerName = openshellContainerName(workspaceName);
  if (containerName.length > OPENSHELL_MAX_HOSTNAME_LENGTH) {
    throw new Error(
      `Workspace name "${workspaceName}" produces OpenShell container name "${containerName}" ` +
        `(${containerName.length} chars), exceeding the ${OPENSHELL_MAX_HOSTNAME_LENGTH}-char ` +
        `Podman/crun hostname limit (${context})`,
    );
  }
}

export function registerSandboxMatrixTests(
  test: typeof providerTest,
  expect: Expect,
  agents: SandboxAgentSetup[],
  scenarios: SandboxScenario[],
): void {
  for (const agent of agents) {
    test.describe(agent.describeAgent, () => {
      for (const scenario of scenarios) {
        const slug = scenario.workspaceSlug ?? scenario.id.toLowerCase();
        const workspaceName = buildWorkspaceName(agent.workspacePrefix, slug);
        assertOpenshellContainerNameFits(workspaceName, `scenario ${scenario.id} / agent ${agent.workspacePrefix}`);
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
