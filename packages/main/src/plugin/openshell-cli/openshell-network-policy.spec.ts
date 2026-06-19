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

import { load } from 'js-yaml';
import { describe, expect, test } from 'vitest';

import { generateNetworkPolicyYaml } from './openshell-network-policy.js';

describe('generateNetworkPolicyYaml', () => {
  test('returns undefined for mode allow', () => {
    expect(generateNetworkPolicyYaml({ mode: 'allow' })).toBeUndefined();
  });

  test('returns undefined for mode deny with no hosts', () => {
    expect(generateNetworkPolicyYaml({ mode: 'deny' })).toBeUndefined();
  });

  test('returns undefined for mode deny with empty hosts array', () => {
    expect(generateNetworkPolicyYaml({ mode: 'deny', hosts: [] })).toBeUndefined();
  });

  test('returns valid YAML for mode deny with one host', () => {
    const yaml = generateNetworkPolicyYaml({ mode: 'deny', hosts: ['registry.npmjs.org'] });

    expect(yaml).toBeDefined();
    const parsed = load(yaml!) as Record<string, unknown>;
    expect(parsed).toEqual({
      version: 1,
      network_policies: {
        workspace_network_access: {
          name: 'workspace-network-access',
          endpoints: [
            {
              host: 'registry.npmjs.org',
              port: 443,
              protocol: 'rest',
              enforcement: 'enforce',
              access: 'read-only',
            },
          ],
        },
      },
    });
  });

  test('returns valid YAML for mode deny with multiple hosts', () => {
    const yaml = generateNetworkPolicyYaml({
      mode: 'deny',
      hosts: ['registry.npmjs.org', 'pypi.python.org'],
    });

    expect(yaml).toBeDefined();
    const parsed = load(yaml!) as Record<string, unknown>;
    const policies = (parsed as { network_policies: { workspace_network_access: { endpoints: unknown[] } } })
      .network_policies.workspace_network_access.endpoints;
    expect(policies).toHaveLength(2);
    expect(policies).toEqual([
      expect.objectContaining({ host: 'registry.npmjs.org' }),
      expect.objectContaining({ host: 'pypi.python.org' }),
    ]);
  });

  test('all endpoints use port 443 and rest protocol', () => {
    const yaml = generateNetworkPolicyYaml({
      mode: 'deny',
      hosts: ['example.com', 'api.example.com'],
    });

    const parsed = load(yaml!) as {
      network_policies: {
        workspace_network_access: {
          endpoints: Array<{ host: string; port: number; protocol: string; enforcement: string; access: string }>;
        };
      };
    };
    for (const endpoint of parsed.network_policies.workspace_network_access.endpoints) {
      expect(endpoint.port).toBe(443);
      expect(endpoint.protocol).toBe('rest');
      expect(endpoint.enforcement).toBe('enforce');
      expect(endpoint.access).toBe('read-only');
    }
  });
});
