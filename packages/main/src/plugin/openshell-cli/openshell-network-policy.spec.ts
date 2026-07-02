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

import {
  buildModelPolicyOperations,
  buildNetworkPolicyEndpoints,
  buildNetworkPolicyOperations,
  buildPolicyObject,
  OPENSHELL_CONTAINER_HOST,
  parseModelEndpoint,
  rewriteLocalhostUrl,
} from './openshell-network-policy.js';

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

  test('returns remove then one add per endpoint for deny mode with hosts', () => {
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

describe('rewriteLocalhostUrl', () => {
  test('rewrites localhost to host.openshell.internal', () => {
    expect(rewriteLocalhostUrl('http://localhost:11434/v1')).toBe(`http://${OPENSHELL_CONTAINER_HOST}:11434/v1`);
  });

  test('rewrites 127.0.0.1 to host.openshell.internal', () => {
    expect(rewriteLocalhostUrl('http://127.0.0.1:11434/v1')).toBe(`http://${OPENSHELL_CONTAINER_HOST}:11434/v1`);
  });

  test('rewrites 0.0.0.0 to host.openshell.internal', () => {
    expect(rewriteLocalhostUrl('http://0.0.0.0:8080/v1')).toBe(`http://${OPENSHELL_CONTAINER_HOST}:8080/v1`);
  });

  test('does not rewrite external URLs', () => {
    expect(rewriteLocalhostUrl('https://api.example.com/v1')).toBe('https://api.example.com/v1');
  });

  test('returns invalid strings unchanged', () => {
    expect(rewriteLocalhostUrl('not-a-url')).toBe('not-a-url');
  });
});

describe('parseModelEndpoint', () => {
  test('parses HTTPS URL with default port', () => {
    expect(parseModelEndpoint('https://api.example.com/v1')).toEqual({
      host: 'api.example.com',
      port: 443,
    });
  });

  test('parses HTTP URL with default port', () => {
    expect(parseModelEndpoint('http://api.example.com/v1')).toEqual({
      host: 'api.example.com',
      port: 80,
    });
  });

  test('parses URL with explicit port', () => {
    expect(parseModelEndpoint('https://api.example.com:8443/v1')).toEqual({
      host: 'api.example.com',
      port: 8443,
    });
  });

  test('rewrites localhost and parses', () => {
    expect(parseModelEndpoint('http://localhost:11434/v1')).toEqual({
      host: OPENSHELL_CONTAINER_HOST,
      port: 11434,
    });
  });

  test('rewrites 127.0.0.1 and parses', () => {
    expect(parseModelEndpoint('http://127.0.0.1:11434/v1')).toEqual({
      host: OPENSHELL_CONTAINER_HOST,
      port: 11434,
    });
  });

  test('returns undefined for invalid URL', () => {
    expect(parseModelEndpoint('not-a-url')).toBeUndefined();
  });

  test('returns undefined for empty string', () => {
    expect(parseModelEndpoint('')).toBeUndefined();
  });

  test('returns undefined for unknown scheme without explicit port', () => {
    expect(parseModelEndpoint('ftp://files.example.com/data')).toBeUndefined();
  });

  test('parses unknown scheme when explicit port is provided', () => {
    expect(parseModelEndpoint('ftp://files.example.com:2121/data')).toEqual({
      host: 'files.example.com',
      port: 2121,
    });
  });
});

describe('buildPolicyObject', () => {
  test('returns undefined when no network and no model endpoint', () => {
    expect(buildPolicyObject()).toBeUndefined();
  });

  test('returns undefined for allow mode with no model endpoint', () => {
    expect(buildPolicyObject({ mode: 'allow' })).toBeUndefined();
  });

  test('returns undefined for deny mode with no hosts and no model endpoint', () => {
    expect(buildPolicyObject({ mode: 'deny' })).toBeUndefined();
  });

  test('returns undefined for deny mode with empty hosts and no model endpoint', () => {
    expect(buildPolicyObject({ mode: 'deny', hosts: [] })).toBeUndefined();
  });

  test('builds network rule for deny mode with hosts', () => {
    const policy = buildPolicyObject({ mode: 'deny', hosts: ['registry.npmjs.org'] });

    expect(policy).toEqual({
      version: 1,
      network_policies: {
        'kdn-network': {
          endpoints: [
            { host: 'registry.npmjs.org', port: 443, access: 'full' },
            { host: 'registry.npmjs.org', port: 80, access: 'full' },
          ],
          binaries: [{ path: '/**' }],
        },
      },
    });
  });

  test('builds model rule for valid endpoint', () => {
    const policy = buildPolicyObject(undefined, 'https://api.example.com/v1');

    expect(policy).toEqual({
      version: 1,
      network_policies: {
        'kdn-model': {
          endpoints: [{ host: 'api.example.com', port: 443 }],
          binaries: [{ path: '/**' }],
        },
      },
    });
  });

  test('combines network and model rules', () => {
    const policy = buildPolicyObject({ mode: 'deny', hosts: ['registry.npmjs.org'] }, 'http://localhost:11434/v1');

    expect(policy).toEqual({
      version: 1,
      network_policies: {
        'kdn-network': {
          endpoints: [
            { host: 'registry.npmjs.org', port: 443, access: 'full' },
            { host: 'registry.npmjs.org', port: 80, access: 'full' },
          ],
          binaries: [{ path: '/**' }],
        },
        'kdn-model': {
          endpoints: [{ host: OPENSHELL_CONTAINER_HOST, port: 11434 }],
          binaries: [{ path: '/**' }],
        },
      },
    });
  });

  test('rewrites localhost model endpoint', () => {
    const policy = buildPolicyObject(undefined, 'http://localhost:11434/v1');

    expect(policy!.network_policies!['kdn-model']!.endpoints[0]!.host).toBe(OPENSHELL_CONTAINER_HOST);
  });

  test('returns only model rule when network is allow mode', () => {
    const policy = buildPolicyObject({ mode: 'allow' }, 'https://api.example.com/v1');

    expect(Object.keys(policy!.network_policies!)).toEqual(['kdn-model']);
  });

  test('returns undefined for invalid model endpoint with no network', () => {
    expect(buildPolicyObject(undefined, 'not-a-url')).toBeUndefined();
  });
});

describe('buildModelPolicyOperations', () => {
  test('returns remove then add for external endpoint', () => {
    const ops = buildModelPolicyOperations('my-sandbox', 'https://api.example.com/v1');

    expect(ops).toHaveLength(2);
    expect(ops[0]).toEqual({ sandboxName: 'my-sandbox', removeRule: 'kdn-model' });
    expect(ops[1]).toEqual({
      sandboxName: 'my-sandbox',
      ruleName: 'kdn-model',
      addEndpoints: ['api.example.com:443'],
      binary: '/**',
      wait: true,
    });
  });

  test('rewrites localhost endpoint to host.openshell.internal', () => {
    const ops = buildModelPolicyOperations('my-sandbox', 'http://localhost:11434/v1');

    expect(ops).toHaveLength(2);
    expect(ops[1]).toEqual({
      sandboxName: 'my-sandbox',
      ruleName: 'kdn-model',
      addEndpoints: [`${OPENSHELL_CONTAINER_HOST}:11434`],
      binary: '/**',
      wait: true,
    });
  });

  test('rewrites 127.0.0.1 endpoint to host.openshell.internal', () => {
    const ops = buildModelPolicyOperations('my-sandbox', 'http://127.0.0.1:11434/v1');

    expect(ops[1]!.addEndpoints).toEqual([`${OPENSHELL_CONTAINER_HOST}:11434`]);
  });

  test('returns remove-only for invalid endpoint', () => {
    const ops = buildModelPolicyOperations('my-sandbox', 'not-a-url');

    expect(ops).toHaveLength(1);
    expect(ops[0]).toEqual({ sandboxName: 'my-sandbox', removeRule: 'kdn-model' });
  });

  test('uses explicit port from URL', () => {
    const ops = buildModelPolicyOperations('my-sandbox', 'https://api.example.com:8443/v1');

    expect(ops[1]!.addEndpoints).toEqual(['api.example.com:8443']);
  });

  test('uses the provided sandbox name', () => {
    const ops = buildModelPolicyOperations('test-sandbox', 'https://api.example.com/v1');

    expect(ops[0]!.sandboxName).toBe('test-sandbox');
    expect(ops[1]!.sandboxName).toBe('test-sandbox');
  });
});
