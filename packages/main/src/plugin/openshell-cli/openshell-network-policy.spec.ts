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

import { describe, expect, test } from 'vitest';

import { buildNetworkPolicyEndpoints, buildNetworkPolicyOperations } from './openshell-network-policy.js';

describe('buildNetworkPolicyEndpoints', () => {
  test('returns undefined for mode allow', () => {
    expect(buildNetworkPolicyEndpoints({ mode: 'allow' })).toBeUndefined();
  });

  test('returns empty array for mode deny with no hosts', () => {
    expect(buildNetworkPolicyEndpoints({ mode: 'deny' })).toEqual([]);
  });

  test('returns empty array for mode deny with empty hosts array', () => {
    expect(buildNetworkPolicyEndpoints({ mode: 'deny', hosts: [] })).toEqual([]);
  });

  test('returns two endpoint strings per host', () => {
    const endpoints = buildNetworkPolicyEndpoints({ mode: 'deny', hosts: ['registry.npmjs.org'] });

    expect(endpoints).toEqual(['registry.npmjs.org:443:full', 'registry.npmjs.org:80:full']);
  });

  test('returns endpoint strings for multiple hosts', () => {
    const endpoints = buildNetworkPolicyEndpoints({
      mode: 'deny',
      hosts: ['registry.npmjs.org', 'pypi.python.org'],
    });

    expect(endpoints).toEqual([
      'registry.npmjs.org:443:full',
      'registry.npmjs.org:80:full',
      'pypi.python.org:443:full',
      'pypi.python.org:80:full',
    ]);
  });

  test('uses full access level', () => {
    const endpoints = buildNetworkPolicyEndpoints({ mode: 'deny', hosts: ['example.com'] })!;

    for (const endpoint of endpoints) {
      expect(endpoint).toMatch(/:full$/);
    }
  });
});

describe('buildNetworkPolicyOperations', () => {
  test('returns remove-only operation for allow mode', () => {
    const ops = buildNetworkPolicyOperations('my-sandbox', { mode: 'allow' });

    expect(ops).toHaveLength(1);
    expect(ops[0]).toEqual({ sandboxName: 'my-sandbox', removeRule: 'kdn-network' });
  });

  test('returns remove-only operation for deny mode with no hosts', () => {
    const ops = buildNetworkPolicyOperations('my-sandbox', { mode: 'deny' });

    expect(ops).toHaveLength(1);
    expect(ops[0]).toEqual({ sandboxName: 'my-sandbox', removeRule: 'kdn-network' });
  });

  test('returns remove-only operation for deny mode with empty hosts', () => {
    const ops = buildNetworkPolicyOperations('my-sandbox', { mode: 'deny', hosts: [] });

    expect(ops).toHaveLength(1);
    expect(ops[0]).toEqual({ sandboxName: 'my-sandbox', removeRule: 'kdn-network' });
  });

  test('returns remove then add operations for deny mode with hosts', () => {
    const ops = buildNetworkPolicyOperations('my-sandbox', {
      mode: 'deny',
      hosts: ['registry.npmjs.org'],
    });

    expect(ops).toHaveLength(3);
    expect(ops[0]).toEqual({ sandboxName: 'my-sandbox', removeRule: 'kdn-network' });
    expect(ops[1]).toEqual({
      sandboxName: 'my-sandbox',
      ruleName: 'kdn-network',
      addEndpoints: ['registry.npmjs.org:443:full'],
      binary: '/**',
      wait: true,
    });
    expect(ops[2]).toEqual({
      sandboxName: 'my-sandbox',
      ruleName: 'kdn-network',
      addEndpoints: ['registry.npmjs.org:80:full'],
      binary: '/**',
      wait: true,
    });
  });

  test('uses the provided sandbox name', () => {
    const ops = buildNetworkPolicyOperations('test-sandbox', {
      mode: 'deny',
      hosts: ['example.com'],
    });

    expect(ops[0]!.sandboxName).toBe('test-sandbox');
    expect(ops[1]!.sandboxName).toBe('test-sandbox');
  });
});
